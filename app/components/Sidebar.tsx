
export default function Sidebar() {
  return (
    <aside className="min-h-screen w-56 bg-[#103f36] text-white p-6">
      
      <div className="mb-12">
        <div className="text-3xl">📖</div>
        <h2 className="mt-2 text-xl font-bold">
          Tajweed Coach
        </h2>
      </div>

      <nav className="space-y-3">

        <button className="w-full rounded-xl bg-[#1b6656] px-4 py-3 text-left font-semibold">
          📖 Quran
        </button>

        <button className="w-full rounded-xl px-4 py-3 text-left text-gray-200 hover:bg-[#1b6656]">
          🎙️ Practice
        </button>

        <button className="w-full rounded-xl px-4 py-3 text-left text-gray-200 hover:bg-[#1b6656]">
          📊 Progress
        </button>

        <button className="w-full rounded-xl px-4 py-3 text-left text-gray-200 hover:bg-[#1b6656]">
          👤 Profile
        </button>

      </nav>
    </aside>
  );
}