export default function Sidebar() {
  // Only the Quran reader is built in this prototype. The other three entries
  // are shown as "coming soon" (disabled) so nobody clicks something that
  // does nothing and thinks the app is broken.
  const soon = [
    { icon: "🎙️", label: "Practice" },
    { icon: "📊", label: "Progress" },
    { icon: "👤", label: "Profile" },
  ];

  return (
    <aside className="min-h-screen w-56 bg-[#103f36] p-6 text-white">
      <div className="mb-12">
        <div className="text-3xl">📖</div>
        <h2 className="mt-2 text-xl font-bold">Tajweed Coach</h2>
      </div>

      <nav className="space-y-3">
        <button
          aria-current="page"
          className="w-full rounded-xl bg-[#1b6656] px-4 py-3 text-left font-semibold"
        >
          📖 Quran
        </button>

        {soon.map((item) => (
          <button
            key={item.label}
            disabled
            aria-disabled="true"
            title="قريبًا · Coming soon"
            className="flex w-full cursor-not-allowed items-center justify-between rounded-xl px-4 py-3 text-left text-gray-400"
          >
            <span>
              {item.icon} {item.label}
            </span>
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-gray-300">
              قريبًا
            </span>
          </button>
        ))}
      </nav>
    </aside>
  );
}
