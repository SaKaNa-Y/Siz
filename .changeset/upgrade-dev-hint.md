---
"@sakana-y/siz": patch
---

Show the dev-dependency marker as a clack `hint` in `siz upgrade`'s package picker. Previously the `[dev]` tag was embedded in the option label, where it collided with the multiselect's dim-based selection styling and made it hard to tell which rows were actually selected. Dev dependencies now render a separate dim `(dev)` hint, kept distinct from the selection state in every row.
