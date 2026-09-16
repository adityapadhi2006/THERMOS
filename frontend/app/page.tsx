"use client";

import dynamic from "next/dynamic";
import React, { useEffect, useMemo, useState } from "react";

const ThermalMap = dynamic(() => import("./components/ThermalMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-[#0F171C] text-sm text-[#8BBB92]">
      Loading thermal map...
    </div>
  ),
});

const API_URL = "http://127.0.0.1:8000";

type ThermalEvent = {
  event_index: number;
  latitude: number;
  longitude: number;
  acq_date: string;
  acq_time: number;
  frp: number;
  confidence: string;
  daynight: string;

  classification: string;
  ai_confidence: number;
  risk_score: number;
  risk_level: string;

  thermal_severity: number;
  persistence_score: number;
  industrial_proximity_score: number;

  event_24h_count: number;
  event_7d_count: number;
  persistence_days: number;

  frp_trend: number;
  brightness_trend: number;
  activity_trend: number;

  distance_to_industry_km: number;
  distance_to_road_km: number;
  distance_to_settlement_km: number;
};

type RegionalHotspot = {
  latitude: number;
  longitude: number;
  event_count: number;
  max_risk: number;
  average_risk: number;
  critical_events: number;
  high_events: number;
  total_frp: number;
  max_persistence: number;
  high_thermal_events: number;
  persistent_events: number;
  industrial_proximity_events: number;
  risk_level: string;
};

type IncidentIntelligence = {
  summary: string;
  reasons: string[];
  recommended_action: string;
  risk_explanation: string;
};

type PredictionResponse = {
  prediction: {
    predicted_label: string;
    confidence: number;
    probabilities: number[];
  };
  risk: {
    risk_score: number;
    risk_level: string;
  };
  features: {
    thermal_severity: number;
    persistence_days: number;
    distance_to_industry_km: number;
    distance_to_road_km: number;
    distance_to_settlement_km: number;
    event_24h_count: number;
    event_7d_count: number;
    frp_trend: number;
    brightness_trend: number;
    activity_trend: number;
  };
  incident_intelligence?: IncidentIntelligence;
};

const CLASSIFICATIONS = [
  "All",
  "Industrial Fire / Flare",
  "Wildfire",
  "Agricultural Burn",
  "Unclassified Anomaly",
];

const RISK_LEVELS = ["All", "Critical", "High", "Medium", "Low"];

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function safeFixed(value: number | null | undefined, digits = 0) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "0";
  }

  return value.toFixed(digits);
}

function getEventId(event: ThermalEvent) {
  return `${event.event_index}-${event.latitude}-${event.longitude}`;
}

function getRiskColor(level: string) {
  switch (level.toLowerCase()) {
    case "critical":
      return "text-red-400";
    case "high":
      return "text-orange-400";
    case "medium":
      return "text-yellow-300";
    case "low":
      return "text-emerald-400";
    default:
      return "text-white/50";
  }
}

function getRiskBg(level: string) {
  switch (level.toLowerCase()) {
    case "critical":
      return "border-red-500/30 bg-red-500/10";
    case "high":
      return "border-orange-500/30 bg-orange-500/10";
    case "medium":
      return "border-yellow-500/30 bg-yellow-500/10";
    case "low":
      return "border-emerald-500/30 bg-emerald-500/10";
    default:
      return "border-white/10 bg-white/[0.03]";
  }
}

function getRiskBar(level: string) {
  switch (level.toLowerCase()) {
    case "critical":
      return "bg-red-500";
    case "high":
      return "bg-orange-500";
    case "medium":
      return "bg-yellow-400";
    case "low":
      return "bg-emerald-500";
    default:
      return "bg-slate-500";
  }
}

function formatTime(value: number) {
  const raw = String(value).padStart(4, "0");

  const hour = raw.slice(0, 2);
  const minute = raw.slice(2, 4);

  return `${hour}:${minute}`;
}

/* -------------------------------------------------------------------------- */
/* Main                                                                       */
/* -------------------------------------------------------------------------- */

export default function Home() {
  const [events, setEvents] = useState<ThermalEvent[]>([]);
  const [regionalHotspots, setRegionalHotspots] = useState<RegionalHotspot[]>(
    [],
  );

  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const [selectedRegion, setSelectedRegion] = useState<RegionalHotspot | null>(
    null,
  );

  const [incidentData, setIncidentData] = useState<IncidentIntelligence | null>(
    null,
  );

  const [classificationFilter, setClassificationFilter] = useState("All");

  const [riskFilter, setRiskFilter] = useState("All");

  const [loading, setLoading] = useState(true);

  const [incidentLoading, setIncidentLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  /* ---------------------------------------------------------------------- */
  /* Load dashboard data                                                   */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    async function loadDashboard() {
      try {
        setLoading(true);
        setError(null);

        const [eventsResponse, regionalResponse] = await Promise.all([
          fetch(`${API_URL}/events`),
          fetch(`${API_URL}/regional-intelligence`),
        ]);

        if (!eventsResponse.ok) {
          throw new Error("Failed to load thermal events.");
        }

        if (!regionalResponse.ok) {
          throw new Error("Failed to load regional intelligence.");
        }

        const eventsJson = await eventsResponse.json();
        const regionalJson = await regionalResponse.json();

        setEvents(eventsJson.events ?? []);
        setRegionalHotspots(regionalJson.regions ?? []);
      } catch (err) {
        console.error(err);
        setError("THERMOS data services are unavailable.");
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, []);

  /* ---------------------------------------------------------------------- */
  /* Filters                                                                */
  /* ---------------------------------------------------------------------- */

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      const classificationMatch =
        classificationFilter === "All" ||
        event.classification === classificationFilter;

      const riskMatch = riskFilter === "All" || event.risk_level === riskFilter;

      return classificationMatch && riskMatch;
    });
  }, [events, classificationFilter, riskFilter]);

  /* ---------------------------------------------------------------------- */
  /* Priority events                                                        */
  /* ---------------------------------------------------------------------- */

  const priorityEvents = useMemo(() => {
    return [...filteredEvents]
      .sort((a, b) => {
        if (b.risk_score !== a.risk_score) {
          return b.risk_score - a.risk_score;
        }

        return b.frp - a.frp;
      })
      .slice(0, 5);
  }, [filteredEvents]);

  const selectedEvent = useMemo(() => {
    if (selectedEventId) {
      return filteredEvents.find(
        (event) => getEventId(event) === selectedEventId,
      );
    }

    return priorityEvents[0];
  }, [selectedEventId, filteredEvents, priorityEvents]);

  const selectedEventIndex = selectedEvent
    ? filteredEvents.findIndex(
        (event) => getEventId(event) === getEventId(selectedEvent),
      )
    : -1;

  const selectedEventBackendIndex = selectedEvent
    ? selectedEvent.event_index
    : -1;

  /* ---------------------------------------------------------------------- */
  /* Statistics                                                             */
  /* ---------------------------------------------------------------------- */

  const stats = useMemo(() => {
    const critical = filteredEvents.filter(
      (event) => event.risk_level === "Critical",
    ).length;

    const high = filteredEvents.filter(
      (event) => event.risk_level === "High",
    ).length;

    const industrial = filteredEvents.filter(
      (event) => event.classification === "Industrial Fire / Flare",
    ).length;

    return {
      total: filteredEvents.length,
      industrial,
      priority: critical + high,
      critical,
      regions: regionalHotspots.length,
    };
  }, [filteredEvents, regionalHotspots]);
  useEffect(() => {
    if (
      selectedEventId &&
      !filteredEvents.some((event) => getEventId(event) === selectedEventId)
    ) {
      setSelectedEventId(null);
    }
  }, [filteredEvents, selectedEventId]);

  /* ---------------------------------------------------------------------- */
  /* Incident intelligence                                                  */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    if (!selectedEvent || selectedEventIndex < 0) {
      setIncidentData(null);
      return;
    }

    async function loadIncident() {
      try {
        setIncidentLoading(true);

        const response = await fetch(`${API_URL}/predict`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            index: selectedEventBackendIndex,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to load incident intelligence.");
        }

        const data: PredictionResponse = await response.json();

        setIncidentData(data.incident_intelligence ?? null);
      } catch (err) {
        console.error(err);
        setIncidentData(null);
      } finally {
        setIncidentLoading(false);
      }
    }

    loadIncident();
  }, [selectedEvent, selectedEventIndex]);

  /* ---------------------------------------------------------------------- */
  /* Loading                                                                */
  /* ---------------------------------------------------------------------- */

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0B0F14] text-white">
        <div className="text-center">
          <div className="mb-3 text-2xl font-semibold tracking-[0.2em]">
            THERMOS
          </div>

          <div className="text-sm text-[#8BBB92]">
            Initializing thermal intelligence...
          </div>
        </div>
      </main>
    );
  }

  /* ---------------------------------------------------------------------- */
  /* Error                                                                  */
  /* ---------------------------------------------------------------------- */

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0B0F14] text-white">
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-8 py-6 text-center">
          <div className="mb-2 text-red-400">THERMOS ERROR</div>

          <div className="text-sm text-white/50">{error}</div>

          <button
            onClick={() => window.location.reload()}
            className="mt-5 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/70 transition hover:bg-white/10"
          >
            Retry
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#092328] text-white">
      {/* ================================================================== */}
      {/* HEADER                                                             */}
      {/* ================================================================== */}

      <header className="border-b border-[#12544F]/60 bg-[#092328]/95">
        <div className="mx-auto flex max-w-[1800px] items-center justify-between px-5 py-3">
          <div className="flex items-center gap-4">
            <div>
              <div className="text-xl font-semibold tracking-[0.18em]">
                THERMOS
              </div>

              <div className="text-[10px] uppercase tracking-[0.22em] text-white/30">
                Industrial Thermal Intelligence
              </div>
            </div>

            <div className="hidden h-7 w-px bg-white/10 sm:block" />

            <div className="hidden text-xs text-[#8BBB92] sm:block">
              Angul–Talcher Industrial Belt
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-3 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />

            <span className="text-[10px] font-medium uppercase tracking-wider text-emerald-300">
              System Online
            </span>
          </div>
        </div>
      </header>

      {/* ================================================================== */}
      {/* DASHBOARD                                                          */}
      {/* ================================================================== */}

      <div className="mx-auto max-w-[1800px] px-5 py-4">
        {/* ---------------------------------------------------------------- */}
        {/* COMPACT CONTROL + STATS                                         */}
        {/* ---------------------------------------------------------------- */}

        <div className="mb-3 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          {/* Filters */}

          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#12544F]/60 bg-[#12544F]/20 px-3 py-2">
            <span className="mr-1 text-[10px] uppercase tracking-[0.18em] text-[#8BBB92]">
              Filter
            </span>

            <select
              value={classificationFilter}
              onChange={(event) => setClassificationFilter(event.target.value)}
              className="rounded-lg border border-[#12544F]/70 bg-[#092328] px-3 py-2 text-xs text-[#8BBB92] outline-none transition hover:border-[#2A835F]"
            >
              {CLASSIFICATIONS.map((classification) => (
                <option
                  key={classification}
                  value={classification}
                  className="bg-[#10181D]"
                >
                  {classification}
                </option>
              ))}
            </select>

            <select
              value={riskFilter}
              onChange={(event) => setRiskFilter(event.target.value)}
              className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/70 outline-none"
            >
              {RISK_LEVELS.map((risk) => (
                <option key={risk} value={risk} className="bg-[#10181D]">
                  {risk} Risk
                </option>
              ))}
            </select>

            {(classificationFilter !== "All" || riskFilter !== "All") && (
              <button
                onClick={() => {
                  setClassificationFilter("All");
                  setRiskFilter("All");
                }}
                className="rounded-lg px-3 py-2 text-xs text-[#8BBB92] transition hover:bg-white/5 hover:text-white/70"
              >
                Reset
              </button>
            )}
          </div>

          {/* Stats */}

          <div className="flex flex-wrap items-center gap-6 rounded-xl border border-white/[0.06] bg-white/[0.015] px-4 py-2">
            <CompactStat label="Thermal Events" value={stats.total} />

            <CompactStat label="Industrial" value={stats.industrial} />

            <CompactStat
              label="High / Critical"
              value={stats.priority}
              emphasis
            />

            <CompactStat label="Critical" value={stats.critical} danger />

            <CompactStat label="Regions" value={stats.regions} />
          </div>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* MAIN COMMAND CENTER                                              */}
        {/* ---------------------------------------------------------------- */}

        <div className="grid min-h-[calc(100vh-150px)] gap-4 xl:grid-cols-[minmax(0,1.75fr)_minmax(340px,0.85fr)]">
          {/* ============================================================ */}
          {/* MAP                                                           */}
          {/* ============================================================ */}

          <section className="relative min-h-[600px] overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0F171C]">
            {/* Map title */}

            <div className="pointer-events-none absolute right-4 top-4 z-[500]">
              <div className="rounded-xl border border-white/[0.08] bg-[#10181D]/85 px-3 py-2 shadow-lg backdrop-blur-md">
                <div className="flex items-center gap-2">
                  <div className="text-xs font-medium text-white/80">
                    Thermal Activity Map
                  </div>

                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[8px] text-[#8BBB92]">
                    {filteredEvents.length} events
                  </span>
                </div>

                <div className="mt-0.5 text-[10px] text-white/30">
                  FIRMS + spatial intelligence
                </div>
              </div>
            </div>

            {/* Legend */}

            <div className="pointer-events-none absolute bottom-4 left-4 z-[500] flex items-center gap-3 rounded-xl border border-white/10 bg-[#111A1F]/90 px-3 py-2 backdrop-blur-md">
              <LegendItem color="bg-red-500" label="Critical" />
              <LegendItem color="bg-orange-500" label="High" />
              <LegendItem color="bg-yellow-400" label="Medium" />
              <LegendItem color="bg-emerald-500" label="Low" />
            </div>

            <ThermalMap
              events={filteredEvents}
              selectedEvent={
                selectedEventIndex >= 0 ? selectedEventIndex : null
              }
              onSelectEvent={(index) => {
                const event = filteredEvents[index];

                if (event) {
                  setSelectedRegion(null);
                  setSelectedEventId(getEventId(event));
                }
              }}
              onSelectRegion={(region) => {
                setSelectedRegion(region);
              }}
              regionalHotspots={regionalHotspots}
            />
          </section>

          {/* ============================================================ */}
          {/* EVENT INTELLIGENCE                                           */}
          {/* ============================================================ */}

          <section className="flex min-h-[600px] flex-col overflow-hidden rounded-2xl border border-[#12544F]/60 bg-[#092328]">
            {/* Panel header */}

            <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3.5">
              <div>
                <div className="flex items-center gap-2">
                  <div className="text-sm font-semibold">
                    Event Intelligence
                  </div>

                  {selectedEventId && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2 py-0.5 text-[8px] font-semibold uppercase tracking-wider text-cyan-300">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#2A835F]" />
                      Selected
                    </span>
                  )}
                </div>

                <div className="mt-0.5 text-[10px] uppercase tracking-[0.18em] text-[#8BBB92]">
                  Priority incident analysis
                </div>
              </div>

              <div className="rounded-full border border-white/10 px-2.5 py-1 text-[9px] uppercase tracking-wider text-white/55">
                AI + Risk
              </div>
            </div>

            {selectedEvent ? (
              <div className="flex-1 overflow-y-auto">
                {/* ------------------------------------------------------ */}
                {/* PRIORITY STRIP                                         */}
                {/* ------------------------------------------------------ */}

                <div className="border-b border-white/[0.06] px-5 py-2.5">
                  <div className="mb-2 text-[9px] uppercase tracking-[0.18em] text-[#8BBB92]">
                    Top priority incidents
                  </div>

                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {priorityEvents.map((event) => {
                      const id = getEventId(event);
                      const active = id === getEventId(selectedEvent);

                      return (
                        <button
                          key={id}
                          onClick={() => setSelectedEventId(id)}
                          className={`min-w-[100px] rounded-lg border px-3 py-1.5 text-left transition ${
                            active
                              ? getRiskBg(event.risk_level)
                              : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05]"
                          }`}
                        >
                          <div
                            className={`text-[9px] font-semibold uppercase tracking-wider ${getRiskColor(
                              event.risk_level,
                            )}`}
                          >
                            {event.risk_level}
                          </div>

                          <div className="mt-0.5 text-sm font-semibold">
                            {safeFixed(event.risk_score)}
                          </div>

                          <div className="mt-0.5 truncate text-[9px] text-white/30">
                            {event.classification}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* ------------------------------------------------------ */}
                {/* ACTIVE INCIDENT                                        */}
                {/* ------------------------------------------------------ */}

                <div className="px-5 py-4">
                  <div className="rounded-xl border border-[#12544F]/50 bg-[#12544F]/15 px-4 py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="text-[9px] uppercase tracking-[0.18em] text-white/30">
                            Active incident
                          </div>

                          <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wider text-cyan-300">
                            AI analyzed
                          </span>
                        </div>

                        <h2 className="mt-2 text-lg font-semibold leading-tight">
                          {selectedEvent.classification}
                        </h2>

                        <div className="mt-1 text-[10px] text-white/35">
                          {selectedEvent.acq_date} ·{" "}
                          {formatTime(selectedEvent.acq_time)} ·{" "}
                          {selectedEvent.daynight === "N" ? "Night" : "Day"}
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <div
                          className={`inline-flex rounded-full border px-2.5 py-1 text-[8px] font-semibold uppercase tracking-wider ${getRiskBg(
                            selectedEvent.risk_level,
                          )} ${getRiskColor(selectedEvent.risk_level)}`}
                        >
                          {selectedEvent.risk_level} PRIORITY
                        </div>

                        <div
                          className={`mt-1 text-2xl font-semibold ${getRiskColor(
                            selectedEvent.risk_level,
                          )}`}
                        >
                          {safeFixed(selectedEvent.risk_score)}
                        </div>

                        <div className="text-[8px] uppercase tracking-wider text-white/30">
                          risk / 100
                        </div>
                      </div>
                    </div>

                    <div className="mt-4">
                      <div className="h-1 overflow-hidden rounded-full bg-white/5">
                        <div
                          className={`h-full rounded-full ${getRiskBar(
                            selectedEvent.risk_level,
                          )}`}
                          style={{
                            width: `${Math.max(
                              0,
                              Math.min(100, selectedEvent.risk_score ?? 0),
                            )}%`,
                          }}
                        />
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <div className="rounded-lg border border-cyan-400/10 bg-cyan-400/[0.025] px-3 py-2.5">
                        <div className="flex items-center justify-between">
                          <div className="text-[8px] uppercase tracking-wider text-white/25">
                            AI Confidence
                          </div>

                          <div className="text-[7px] uppercase tracking-wider text-cyan-300/50">
                            Model
                          </div>
                        </div>

                        <div className="mt-1 text-sm font-semibold text-cyan-300">
                          {safeFixed(selectedEvent.ai_confidence)}%
                        </div>
                      </div>

                      <div className="rounded-lg border border-white/[0.06] bg-white/[0.025] px-3 py-2.5">
                        <div className="text-[8px] uppercase tracking-wider text-white/25">
                          Thermal Severity
                        </div>

                        <div className="mt-1 text-sm font-semibold text-white/80">
                          {safeFixed(selectedEvent.thermal_severity)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ------------------------------------------------------ */}
                {/* RECOMMENDED ACTION                                     */}
                {/* ------------------------------------------------------ */}

                {incidentData && (
                  <div className="border-t border-white/[0.06] px-5 py-3">
                    <SectionLabel>Recommended action</SectionLabel>

                    <div
                      className={`mt-2 rounded-lg px-3 py-2 ${getRiskBg(
                        selectedEvent.risk_level,
                      )}`}
                    >
                      <div className="text-[11px] font-medium leading-relaxed text-white/75">
                        {incidentData.recommended_action}
                      </div>
                    </div>
                  </div>
                )}

                {/* ------------------------------------------------------ */}
                {/* INTELLIGENCE ASSESSMENT                                */}
                {/* ------------------------------------------------------ */}

                {/* ------------------------------------------------------ */}
                {/* INTELLIGENCE ASSESSMENT + RISK FACTORS                */}
                {/* ------------------------------------------------------ */}

                <div className="grid grid-cols-2 border-t border-white/[0.06]">
                  {/* Intelligence Assessment */}

                  <div className="border-r border-white/[0.06] px-5 py-4">
                    <div className="flex items-center justify-between">
                      <SectionLabel>Intelligence assessment</SectionLabel>

                      <span className="text-[8px] uppercase tracking-wider text-white/30">
                        AI analysis
                      </span>
                    </div>

                    {incidentLoading ? (
                      <div className="mt-3 rounded-lg bg-white/[0.02] px-3 py-3 text-[10px] text-white/35">
                        Generating intelligence...
                      </div>
                    ) : incidentData ? (
                      <div className="mt-3">
                        {/* Incident intelligence */}

                        <div>
                          <div className="text-[8px] uppercase tracking-[0.18em] text-white/40">
                            Incident intelligence
                          </div>

                          <p className="mt-1.5 text-[10px] leading-relaxed text-white/65">
                            {incidentData.summary}
                          </p>
                        </div>

                        {/* Key indicators */}

                        <div className="mt-3 border-t border-white/[0.05] pt-3">
                          <div className="text-[8px] uppercase tracking-[0.18em] text-white/40">
                            Key indicators
                          </div>

                          <div className="mt-2 space-y-1.5">
                            {incidentData.reasons
                              .slice(0, 4)
                              .map((reason, index) => (
                                <div
                                  key={`${reason}-${index}`}
                                  className="flex items-start gap-2"
                                >
                                  <span className="mt-0.5 text-[10px] text-red-400">
                                    •
                                  </span>

                                  <span className="text-[10px] leading-relaxed text-white/60">
                                    {reason}
                                  </span>
                                </div>
                              ))}
                          </div>
                        </div>

                        {/* Risk explanation */}

                        <div className="mt-3 border-t border-white/[0.05] pt-3">
                          <div className="text-[8px] uppercase tracking-[0.18em] text-white/40">
                            Risk explanation
                          </div>

                          <p className="mt-1.5 text-[10px] leading-relaxed text-white/55">
                            {incidentData.risk_explanation}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 text-[10px] leading-relaxed text-white/35">
                        Thermal and spatial indicators require further
                        verification.
                      </div>
                    )}
                  </div>

                  {/* Risk Factors */}

                  <div className="px-5 py-4">
                    <SectionLabel>Risk factors</SectionLabel>

                    <div className="mt-3 space-y-3">
                      <RiskFactor
                        label="Industrial proximity"
                        value={`${safeFixed(
                          selectedEvent.distance_to_industry_km,
                          1,
                        )} km`}
                        score={selectedEvent.industrial_proximity_score}
                      />

                      <RiskFactor
                        label="Persistence"
                        value={`${safeFixed(
                          selectedEvent.persistence_days,
                        )} days`}
                        score={selectedEvent.persistence_score}
                      />

                      <RiskFactor
                        label="Nearby activity"
                        value={`${safeFixed(
                          selectedEvent.event_7d_count,
                        )} events / 7d`}
                        score={Math.min(100, selectedEvent.event_7d_count * 5)}
                      />
                    </div>
                  </div>
                </div>
                {/* ------------------------------------------------------ */}
                {/* TEMPORAL + LOCATION                                    */}
                {/* ------------------------------------------------------ */}

                <div className="grid grid-cols-2 border-t border-white/[0.06]">
                  {/* Temporal Intelligence */}
                  <div className="border-r border-white/[0.06] px-5 py-4">
                    <SectionLabel>Temporal intelligence</SectionLabel>

                    <div className="grid grid-cols-3 gap-2">
                      <MiniMetric
                        label="24h"
                        value={safeFixed(selectedEvent.event_24h_count)}
                      />

                      <MiniMetric
                        label="7d"
                        value={safeFixed(selectedEvent.event_7d_count)}
                      />

                      <MiniMetric
                        label="Persistence"
                        value={`${safeFixed(selectedEvent.persistence_days)}d`}
                      />
                    </div>

                    <div className="mt-3 space-y-2">
                      <TrendRow
                        label="FRP trend"
                        value={selectedEvent.frp_trend}
                      />

                      <TrendRow
                        label="Brightness trend"
                        value={selectedEvent.brightness_trend}
                      />

                      <TrendRow
                        label="Activity trend"
                        value={selectedEvent.activity_trend}
                      />
                    </div>
                  </div>

                  {/* Location Context */}
                  <div className="px-5 py-4">
                    <SectionLabel>Location context</SectionLabel>

                    <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                      <InfoItem
                        label="Latitude"
                        value={safeFixed(selectedEvent.latitude, 5)}
                      />

                      <InfoItem
                        label="Longitude"
                        value={safeFixed(selectedEvent.longitude, 5)}
                      />

                      <InfoItem
                        label="Road distance"
                        value={`${safeFixed(
                          selectedEvent.distance_to_road_km,
                          1,
                        )} km`}
                      />

                      <InfoItem
                        label="Settlement distance"
                        value={`${safeFixed(
                          selectedEvent.distance_to_settlement_km,
                          1,
                        )} km`}
                      />

                      <InfoItem
                        label="FRP"
                        value={safeFixed(selectedEvent.frp, 2)}
                      />

                      <InfoItem
                        label="FIRMS confidence"
                        value={selectedEvent.confidence}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center px-8 text-center">
                <div>
                  <div className="text-sm text-[#8BBB92]">
                    No matching thermal events
                  </div>

                  <div className="mt-1 text-xs text-white/30">
                    Adjust the dashboard filters.
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
        {/* ================================================================= */}
        {/* BOTTOM INTELLIGENCE STRIP                                         */}
        {/* ================================================================= */}

        <div className="mt-4 grid gap-4 lg:grid-cols-[1.25fr_1fr]">
          {/* ---------------------------------------------------------------- */}
          {/* REGIONAL HOTSPOTS                                               */}
          {/* ---------------------------------------------------------------- */}

          <section className="rounded-2xl border border-white/[0.07] bg-[#0B0F14] p-4">
            <div className="mb-3 flex items-center justify-between">
              <SectionLabel>Regional hotspots · All events</SectionLabel>

              <span className="text-[9px] text-white/25">
                {regionalHotspots.length} regions
              </span>
            </div>

            <div className="space-y-1.5">
              {regionalHotspots.slice(0, 5).map((region, index) => (
                <button
                  key={`${region.latitude}-${region.longitude}-${index}`}
                  onClick={() => setSelectedRegion(region)}
                  className="flex w-full items-center justify-between rounded-lg border border-transparent px-3 py-2 text-left transition hover:border-white/10 hover:bg-white/[0.03]"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-4 text-[10px] text-white/30">
                      {index + 1}
                    </span>

                    <div>
                      <div className="text-xs text-white/70">
                        {safeFixed(region.latitude, 2)},{" "}
                        {safeFixed(region.longitude, 2)}
                      </div>

                      <div className="mt-0.5 text-[9px] text-white/25">
                        {region.event_count} events
                        {" · "}
                        {region.critical_events} critical
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div
                      className={`text-sm font-semibold ${getRiskColor(
                        region.risk_level,
                      )}`}
                    >
                      {safeFixed(region.max_risk)}
                    </div>

                    <div className="text-[8px] uppercase tracking-wider text-white/30">
                      max risk
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* ---------------------------------------------------------------- */}
          {/* SELECTED REGION                                                  */}
          {/* ---------------------------------------------------------------- */}

          <section className="rounded-2xl border border-white/[0.07] bg-[#0B0F14] p-4">
            <div className="flex items-center justify-between">
              <SectionLabel>Regional intelligence</SectionLabel>

              {selectedRegion && (
                <button
                  onClick={() => setSelectedRegion(null)}
                  className="text-[9px] text-white/25 transition hover:text-white/60"
                >
                  Clear
                </button>
              )}
            </div>

            {selectedRegion ? (
              <div className="mt-3">
                {/* Region identity + risk */}

                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-medium text-white/80">
                      {safeFixed(selectedRegion.latitude, 2)},{" "}
                      {safeFixed(selectedRegion.longitude, 2)}
                    </div>

                    <div
                      className={`mt-1 text-[10px] font-semibold uppercase tracking-wider ${getRiskColor(
                        selectedRegion.risk_level,
                      )}`}
                    >
                      {selectedRegion.risk_level} region
                    </div>
                  </div>

                  <div className="text-right">
                    <div
                      className={`text-2xl font-semibold ${getRiskColor(
                        selectedRegion.risk_level,
                      )}`}
                    >
                      {safeFixed(selectedRegion.max_risk)}
                    </div>

                    <div className="text-[8px] uppercase tracking-wider text-white/30">
                      max risk
                    </div>
                  </div>
                </div>

                {/* Core regional metrics */}

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <MiniMetric
                    label="Events"
                    value={safeFixed(selectedRegion.event_count)}
                  />

                  <MiniMetric
                    label="Average risk"
                    value={safeFixed(selectedRegion.average_risk)}
                  />

                  <MiniMetric
                    label="Critical"
                    value={safeFixed(selectedRegion.critical_events)}
                  />

                  <MiniMetric
                    label="High risk"
                    value={safeFixed(selectedRegion.high_events)}
                  />
                </div>

                {/* Regional indicators */}

                <div className="mt-4">
                  <SectionLabel>Regional indicators</SectionLabel>

                  <div className="mt-3 space-y-2">
                    <RegionIndicator
                      label="High thermal activity"
                      value={selectedRegion.high_thermal_events}
                    />

                    <RegionIndicator
                      label="Persistent activity"
                      value={selectedRegion.persistent_events}
                    />

                    <RegionIndicator
                      label="Industrial proximity"
                      value={selectedRegion.industrial_proximity_events}
                    />
                  </div>
                </div>

                {/* Supporting intelligence */}

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <MiniMetric
                    label="Total FRP"
                    value={safeFixed(selectedRegion.total_frp, 2)}
                  />

                  <MiniMetric
                    label="Max persistence"
                    value={`${safeFixed(selectedRegion.max_persistence)}d`}
                  />
                </div>
              </div>
            ) : (
              <div className="mt-4 text-xs text-white/25">
                Select a regional hotspot to inspect its intelligence.
              </div>
            )}
          </section>
        </div>
      </div>

      {/* ================================================================== */}
      {/* FOOTER                                                             */}
      {/* ================================================================== */}

      <footer className="border-t border-white/[0.05] px-5 py-3">
        <div className="mx-auto flex max-w-[1800px] items-center justify-between text-[9px] uppercase tracking-[0.15em] text-white/30">
          <span>THERMOS · AI-Based Industrial Thermal Intelligence</span>

          <span>Prototype Intelligence System</span>
        </div>
      </footer>
    </main>
  );
}

/* ========================================================================== */
/* COMPONENTS                                                                 */
/* ========================================================================== */

function CompactStat({
  label,
  value,
  emphasis = false,
  danger = false,
}: {
  label: string;
  value: number;
  emphasis?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`text-lg font-semibold ${
          danger
            ? "text-red-400"
            : emphasis
              ? "text-orange-300"
              : "text-white/85"
        }`}
      >
        {value}
      </span>

      <span className="text-[9px] uppercase tracking-wider text-white/25">
        {label}
      </span>
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`h-1.5 w-1.5 rounded-full ${color}`} />

      <span className="text-[9px] text-[#8BBB92]">{label}</span>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[9px] font-medium uppercase tracking-[0.18em] text-[#8BBB92]">
      {children}
    </div>
  );
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-3">
      <div className="text-[9px] uppercase tracking-wider text-white/25">
        {label}
      </div>

      <div className="mt-1 text-sm font-semibold text-white/80">{value}</div>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#12544F]/50 bg-[#12544F]/15 px-3 py-2">
      <div className="text-[8px] uppercase tracking-wider text-[#8BBB92]/70">
        {label}
      </div>

      <div className="mt-1 text-sm font-medium text-white/80">{value}</div>
    </div>
  );
}

function RiskFactor({
  label,
  value,
  score,
}: {
  label: string;
  value: string;
  score: number;
}) {
  const safeScore =
    typeof score === "number" && Number.isFinite(score)
      ? Math.max(0, Math.min(100, score))
      : 0;

  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-white/65">{label}</span>

        <span className="text-[10px] text-white/65">{value}</span>
      </div>

      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/5">
        <div
          className="h-full rounded-full bg-white/30"
          style={{
            width: `${safeScore}%`,
          }}
        />
      </div>
    </div>
  );
}

function TrendRow({
  label,
  value,
}: {
  label: string;
  value: number | null | undefined;
}) {
  const safeValue =
    typeof value === "number" && Number.isFinite(value) ? value : 0;

  let symbol = "→";
  let status = "Stable";

  if (safeValue > 1) {
    symbol = "↗";
    status = "Increasing";
  } else if (safeValue < -1) {
    symbol = "↘";
    status = "Decreasing";
  }

  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px] text-[#8BBB92]/75">{label}</span>

      <div className="flex items-center gap-2">
        <span className="text-xs text-[#8BBB92]">{symbol}</span>

        <span className="text-[10px] text-white/75">{status}</span>

        <span className="text-[9px] text-[#8BBB92]/60">
          {safeValue.toFixed(1)}
        </span>
      </div>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[8px] uppercase tracking-wider text-[#8BBB92]/65">
        {label}
      </div>

      <div className="mt-0.5 text-[11px] text-white/80">{value}</div>
    </div>
  );
}

function RegionIndicator({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2">
      <span className="text-[10px] text-[#8BBB92]">{label}</span>

      <span className="text-sm font-medium text-white/75">
        {safeFixed(value)}
      </span>
    </div>
  );
}
