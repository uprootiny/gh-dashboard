;; Canonical frame ontology for Hynous Foundry
;; This is the authoritative structural spec.
;; Rendered views, backend schemas, and acceptance checks derive from this.

(def frame-kernel
  [:frame/root
   [:frame/parent-context
    [:frame/invariants]
    [:frame/contracts]
    [:frame/quota]]
   [:frame/child-harness
    [:frame/evidence]
    [:frame/hypotheses]
    [:frame/tensions]
    [:frame/brief]
    [:frame/self-diagnostics]]
   [:frame/developer-loop
    [:frame/task-envelope]
    [:frame/child-result]
    [:frame/acceptance]
    [:frame/trace-ledger]
    [:frame/recovery]]
   [:frame/sibling-branches
    [:frame/repair-branch]
    [:frame/ritual-branch]
    [:frame/provider-resilience-branch]]])
