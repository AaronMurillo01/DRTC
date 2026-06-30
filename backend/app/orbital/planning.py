"""Contact scheduling: resolve ground-station contention into a clean plan.

The pass list is a wish list, not a plan. A station antenna can service one
contact at a time, and a satellite can only talk to one station at a time, so
overlapping passes conflict. This picks the conflict-free subset that maximizes
downlinked volume, expressed as a CP-SAT no-overlap (disjunctive) model:

  - one optional interval per candidate pass, present iff the pass is scheduled
  - AddNoOverlap over the intervals at each station (one antenna)
  - AddNoOverlap over the intervals for each satellite (one contact at a time)
  - maximize the total volume of the scheduled passes

It is the same shape as a small job-shop / disjunctive-scheduling problem.
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass

from ortools.sat.python import cp_model

from .passes import ContactWindow


@dataclass(frozen=True)
class PlanResult:
    scheduled_ids: frozenset[str]
    requested: int
    scheduled_count: int
    dropped_count: int
    total_volume_mb: float
    status: str


def plan_contacts(passes: list[ContactWindow]) -> PlanResult:
    if not passes:
        return PlanResult(frozenset(), 0, 0, 0, 0.0, "EMPTY")

    model = cp_model.CpModel()

    # Normalize to integer seconds from the earliest AOS to keep the domain small.
    t0 = min(p.aos for p in passes)

    present: dict[str, cp_model.IntVar] = {}
    by_station: dict[str, list] = defaultdict(list)
    by_sat: dict[int, list] = defaultdict(list)

    for p in passes:
        start = int((p.aos - t0) / 1000)
        end = int((p.los - t0) / 1000)
        size = max(1, end - start)
        end = start + size
        x = model.NewBoolVar(f"sched_{p.id}")
        interval = model.NewOptionalIntervalVar(start, size, end, x, f"iv_{p.id}")
        present[p.id] = x
        by_station[p.station_id].append(interval)
        by_sat[p.sat_id].append(interval)

    for intervals in by_station.values():
        model.AddNoOverlap(intervals)
    for intervals in by_sat.values():
        model.AddNoOverlap(intervals)

    # Prefer high-value passes; the +1 keeps a tie-break toward more contacts.
    model.Maximize(sum((int(p.volume_mb) + 1) * present[p.id] for p in passes))

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 5.0
    solver.parameters.num_search_workers = 4
    status = solver.Solve(model)

    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return PlanResult(frozenset(), len(passes), 0, len(passes), 0.0, "INFEASIBLE")

    scheduled = frozenset(p.id for p in passes if solver.Value(present[p.id]) == 1)
    volume = sum(p.volume_mb for p in passes if p.id in scheduled)
    return PlanResult(
        scheduled_ids=scheduled,
        requested=len(passes),
        scheduled_count=len(scheduled),
        dropped_count=len(passes) - len(scheduled),
        total_volume_mb=volume,
        status="OPTIMAL" if status == cp_model.OPTIMAL else "FEASIBLE",
    )
