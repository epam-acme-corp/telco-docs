---
title: "ADR-002 C++ Rating Engine"
---


# ADR-002: Retain C++ Rating Engine

## Status

Accepted (2023)

## Context

The Rating & Charging Engine is the most performance-critical system in Acme Telco's billing pipeline. It processes all CDRs (Call Detail Records) for approximately 3.2 million mobile subscribers, handling both real-time online charging for prepaid subscribers and batch offline rating for postpaid subscribers.

**Performance requirements:**
- Peak throughput: 50,000 CDRs/second during evening hours (7 PM – 10 PM EST)
- Average throughput: ~15,000 CDRs/second
- Online charging latency: p99 < 5ms (prepaid balance check + debit must complete before the network session is authorized)
- Offline rating latency: p99 < 50ms (postpaid rating is batch-optimized and less latency-sensitive)

The existing C++ 17 implementation meets these requirements with headroom — current peak capacity is approximately 35,000 CDRs/second sustained, with burst capacity to 50,000.

In 2023, the BSS Engineering team evaluated whether to rewrite the rating engine in a managed language to reduce the specialized talent requirement. A Java 17 prototype using Spring Boot and GraalVM native image was built and benchmarked.

**Benchmark results (equivalent hardware — 32-core Azure VM, 128GB RAM):**
- C++ 17 (current): ~50,000 CDRs/sec sustained, p99 latency 2.1ms
- Java 17 + GraalVM native image: ~12,000 CDRs/sec sustained, p99 latency 8.5ms
- Java 17 (JVM, no native image): ~8,000 CDRs/sec sustained, p99 latency 15ms

The Java prototype achieved approximately 24% of the C++ throughput. While optimization could improve this, the engineering team estimated that closing the gap to the required 50K CDRs/sec threshold would require significant investment with uncertain outcomes, particularly for the sub-5ms latency requirement on online charging.

## Decision

Retain the C++ 17 rating engine as the production implementation. To mitigate the talent and maintainability risks:

1. **gRPC API wrapper:** Expose all rating engine functionality through a well-documented gRPC API. Consuming systems (Billing Mediation, Self-Service Portal) interact only with the gRPC interface and do not require C++ knowledge.
2. **Targeted hiring:** Invest in recruiting C++ developers with systems programming experience. Target team size: 6 developers (current: 4).
3. **Cross-training program:** Two Java developers from the BSS team are participating in a C++ cross-training program to build basic maintenance capability.
4. **Code review standards:** Minimum 2 senior C++ reviewers required for all production changes. Automated testing coverage target: 85% line coverage.
5. **Performance regression testing:** Automated benchmark suite runs on every PR to detect throughput or latency regressions before merge.

## Consequences

### Positive

- **Performance requirements met with headroom:** Current peak capacity of 50K CDRs/sec provides room for 5G-driven traffic growth (projected 15% annual CDR volume increase).
- **Redis integration:** C++ integrates naturally with Redis via hiredis library for sub-millisecond subscriber balance lookups. The 12GB memory footprint for 3.2M subscriber balance records is efficiently managed.
- **Clean integration boundary:** The gRPC API completely abstracts the C++ implementation. Consuming systems see a standard gRPC service; the implementation language is invisible at the API level.
- **Proven stability:** The rating engine has been in production for 7 years with zero data-loss incidents. CDR processing accuracy (rated amount matches expected amount) exceeds 99.999%.

### Negative

- **Limited talent pool:** C++ developers with telco billing domain experience are scarce in the Atlanta market. Current team of 4 is below the target of 6. Average time-to-hire for qualified candidates: 4–6 months.
- **Higher onboarding time:** New C++ developers require approximately 3 months to become productive on the rating engine codebase, compared to ~1 month for Java services.
- **Dependency management limitations:** The C++ ecosystem has less comprehensive vulnerability databases than Java or JavaScript. Dependabot support for Conan (C++ package manager) is limited, requiring manual dependency audits for some libraries.
- **GHAS coverage gap:** CodeQL C++ scanning covers fewer vulnerability patterns than Java scanning. Some security checks that are automated for Java services require manual code review for the C++ rating engine.

## Alternatives Considered

### Java Rewrite with GraalVM Native Image

**Rejected.** Benchmark showed 24% of required throughput. Even with optimization, achieving 50K CDRs/sec with sub-5ms p99 latency was deemed unlikely. The risk of a multi-month rewrite that fails to meet performance requirements was unacceptable for a revenue-critical system.

### Rust Rewrite

**Considered but rejected.** Rust would likely meet performance requirements (comparable to C++ for this workload profile). However, the Rust talent pool is even smaller than C++ in the telco domain. Migration risk for a revenue-critical system was deemed too high. Rust remains on the technology radar for future consideration if the talent landscape changes.

### Go Rewrite

**Rejected.** Go's garbage collector introduces unpredictable pause times that conflict with the sub-5ms p99 latency requirement for online charging. While Go's GC has improved significantly, the telco rating workload (millions of small allocations per second for CDR processing) is a worst-case scenario for GC-based languages.

### Horizontal Scaling with Java

**Considered but rejected.** Running 4–5 Java instances to match one C++ instance's throughput would increase infrastructure cost, operational complexity (more instances to monitor, deploy, and coordinate), and introduce data consistency challenges for the shared Redis subscriber balance cache.
