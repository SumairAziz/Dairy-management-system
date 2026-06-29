export function MilkMetricCard({
  label,
  value,
  sessions,
}: {
  label: string;
  value: string;
  sessions?: Record<string, number>;
}) {
  // Filter sessions that have production > 0
  const activeSessions = sessions
    ? Object.entries(sessions)
        .filter(([_, liters]) => liters > 0)
        .map(([session, liters]) => ({
          session,
          liters,
        }))
    : [];

  return (
    <div className="surface border rounded-2xl p-5 space-y-3">
      <div className="text-xs font-medium text-brand-400 uppercase tracking-wide">
        {label}
      </div>
      <div className="text-3xl font-bold">{value}</div>

      {activeSessions.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-2 border-t border-white/10">
          {activeSessions.map(({ session, liters }) => (
            <div key={session} className="text-xs muted">
              <span className="text-white/60">{session}</span> {liters} L
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
