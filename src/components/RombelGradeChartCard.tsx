import React, { useMemo, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  computeRombelGradeDistribution,
  type EraporDataset,
} from '../lib/eraporCore';

interface RombelGradeChartCardProps {
  dataset: EraporDataset;
  defaultRombelId?: string;
  onOpenGrades: (rombelId: string) => void;
}

type ChartMode = 'distribusi' | 'perbandingan';

export const RombelGradeChartCard: React.FC<RombelGradeChartCardProps> = ({
  dataset,
  defaultRombelId,
  onOpenGrades,
}) => {
  const initialRombel = useMemo(() => {
    if (defaultRombelId && dataset.rombels.some((r) => r.id === defaultRombelId)) {
      return defaultRombelId;
    }
    const rombelWithGrades = dataset.rombels.find((rb) =>
      dataset.grades.some((g) => g.rombelId === rb.id && g.nilaiAkhir > 0)
    );
    return rombelWithGrades?.id || dataset.rombels[0]?.id || 'ALL';
  }, [dataset.rombels, dataset.grades, defaultRombelId]);

  const [selectedRombelId, setSelectedRombelId] = useState<string>(initialRombel);
  const [selectedMapelId, setSelectedMapelId] = useState<string>('ALL');
  const [chartMode, setChartMode] = useState<ChartMode>('distribusi');

  const activeRombelId =
    selectedRombelId === 'ALL' || dataset.rombels.some((r) => r.id === selectedRombelId)
      ? selectedRombelId
      : initialRombel;

  const activeMapelId =
    selectedMapelId === 'ALL' || dataset.subjects.some((s) => s.id === selectedMapelId)
      ? selectedMapelId
      : 'ALL';

  const dist = useMemo(
    () => computeRombelGradeDistribution(dataset, activeRombelId, activeMapelId),
    [dataset, activeRombelId, activeMapelId]
  );

  const rombelComparisonData = useMemo(
    () =>
      dataset.rombels.map((rb) => {
        const stat = computeRombelGradeDistribution(dataset, rb.id, activeMapelId);
        return {
          rombelId: rb.id,
          rombelNama: rb.nama,
          rataRata: stat.average,
          median: stat.median,
          tuntasPct: stat.tuntasPct,
          gradedStudents: stat.gradedStudents,
          totalStudents: stat.totalStudents,
        };
      }),
    [dataset, activeMapelId]
  );

  return (
    <section
      aria-label="Analisis Statistik dan Distribusi Nilai Siswa per Rombel"
      className="rounded-xl border border-slate-200 bg-white p-6"
    >
      {/* Header & Controls */}
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-700">
            <BarChart3 className="h-4 w-4" aria-hidden="true" />
            <span>Statistik &amp; Sebaran Capaian Akademik</span>
          </div>
          <h2 className="mt-1 text-base font-bold text-slate-900">
            Distribusi Nilai Siswa per Rombel
          </h2>
          <p className="mt-0.5 text-xs text-slate-600">
            Pemetaan rentang nilai peserta didik, ukuran pemusatan (rata-rata, median, simpangan baku), dan ketuntasan terhadap KKTP.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div
            className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-1"
            role="tablist"
            aria-label="Mode tampilan grafik nilai"
          >
            <button
              type="button"
              role="tab"
              aria-selected={chartMode === 'distribusi'}
              onClick={() => setChartMode('distribusi')}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                chartMode === 'distribusi'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Distribusi Rentang Nilai
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={chartMode === 'perbandingan'}
              onClick={() => setChartMode('perbandingan')}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                chartMode === 'perbandingan'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Rata-Rata Antar Rombel
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:max-w-xl w-full">
          <div>
            <label
              htmlFor="chart-rombel-select"
              className="block text-xs font-semibold text-slate-700"
            >
              Rombongan Belajar
            </label>
            <select
              id="chart-rombel-select"
              value={activeRombelId}
              disabled={chartMode === 'perbandingan'}
              onChange={(e) => setSelectedRombelId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 disabled:bg-slate-50 disabled:text-slate-500"
            >
              <option value="ALL">Semua Rombel ({dataset.rombels.length} kelas)</option>
              {dataset.rombels.map((rb) => (
                <option key={rb.id} value={rb.id}>
                  {rb.nama} · Wali: {rb.waliKelasNama}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="chart-mapel-select"
              className="block text-xs font-semibold text-slate-700"
            >
              Mata Pelajaran
            </label>
            <select
              id="chart-mapel-select"
              value={activeMapelId}
              onChange={(e) => setSelectedMapelId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900"
            >
              <option value="ALL">Semua Mata Pelajaran (Rata-Rata Siswa)</option>
              {dataset.subjects.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.kode} · {sub.nama} (KKTP {sub.kkm})
                </option>
              ))}
            </select>
          </div>
        </div>

        <p className="text-xs text-slate-500 font-mono tabular-nums whitespace-nowrap shrink-0">
          Acuan KKTP: <strong className="text-slate-900">{dist.kktpThreshold}</strong>
          <span aria-hidden="true"> · </span>
          {dist.gradedStudents}/{dist.totalStudents} siswa bernilai
        </p>
      </div>

      {/* 4-Column Unboxed Descriptive Statistics Strip */}
      <div className="mt-4 grid grid-cols-2 gap-4 border-y border-slate-100 py-4 sm:grid-cols-4">
        <div>
          <p className="text-[11px] font-medium text-slate-500">Rata-Rata Nilai</p>
          <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-slate-900">
            {dist.gradedStudents > 0 ? dist.average.toFixed(1) : '—'}
          </p>
          <p className="mt-0.5 font-mono text-[11px] tabular-nums text-slate-500">
            Simpangan baku ±{dist.stdDev.toFixed(1)}
          </p>
        </div>

        <div>
          <p className="text-[11px] font-medium text-slate-500">Nilai Tengah (Median)</p>
          <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-slate-900">
            {dist.gradedStudents > 0 ? dist.median.toFixed(1) : '—'}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {dist.rombelNama}
          </p>
        </div>

        <div>
          <p className="text-[11px] font-medium text-slate-500">Rentang Skor (Min – Maks)</p>
          <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-slate-900">
            {dist.gradedStudents > 0
              ? `${Math.round(dist.lowest)} – ${Math.round(dist.highest)}`
              : '—'}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Skala rapor 0–100
          </p>
        </div>

        <div>
          <p className="text-[11px] font-medium text-slate-500">Ketuntasan KKTP</p>
          <p
            className={`mt-1 font-mono text-2xl font-bold tabular-nums ${
              dist.gradedStudents === 0
                ? 'text-slate-400'
                : dist.tuntasPct >= 80
                  ? 'text-emerald-700'
                  : 'text-amber-700'
            }`}
          >
            {dist.gradedStudents > 0 ? `${dist.tuntasPct}%` : '—'}
          </p>
          <p className="mt-0.5 font-mono text-[11px] tabular-nums text-slate-500">
            {dist.tuntasCount} dari {dist.gradedStudents} siswa ≥ {dist.kktpThreshold}
          </p>
        </div>
      </div>

      {/* Recharts Bar Chart Viewport */}
      {chartMode === 'distribusi' ? (
        dist.gradedStudents === 0 ? (
          <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 px-6 py-10 text-center">
            <p className="text-xs font-semibold text-slate-800">
              Belum ada nilai sumatif yang tersimpan untuk {dist.rombelNama} ({dist.mapelNama}).
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Grafik distribusi batang akan muncul otomatis setelah guru menginput atau mengimpor nilai siswa.
            </p>
            <button
              type="button"
              onClick={() =>
                onOpenGrades(activeRombelId === 'ALL' ? dataset.rombels[0]?.id || '' : activeRombelId)
              }
              className="mt-3 inline-flex items-center rounded-lg bg-blue-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-800 cursor-pointer"
            >
              Input Nilai Rombel Sekarang
            </button>
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            <div className="h-72 w-full" data-testid="rombel-distribution-chart">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={dist.buckets}
                  margin={{ top: 12, right: 16, left: 4, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: '#334155', fontSize: 12, fontWeight: 600 }}
                    axisLine={{ stroke: '#cbd5e1' }}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: '#475569', fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    width={42}
                    label={{
                      value: 'Siswa',
                      angle: -90,
                      position: 'insideLeft',
                      fill: '#64748b',
                      fontSize: 11,
                    }}
                  />
                  <Tooltip
                    cursor={{ fill: '#f8fafc' }}
                    content={({ active, payload }) => {
                      if (!active || !payload || payload.length === 0) return null;
                      const item = payload[0].payload as (typeof dist.buckets)[number];
                      return (
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm">
                          <p className="font-bold text-slate-900">{item.rangeLabel}</p>
                          <p className="mt-1 font-mono tabular-nums text-slate-700">
                            Jumlah: <strong className="text-slate-900">{item.count} siswa</strong> ({item.pct}%)
                          </p>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="count" name="Jumlah Siswa" radius={[6, 6, 0, 0]} maxBarSize={68}>
                    {dist.buckets.map((entry) => (
                      <Cell key={entry.key} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Clean Unboxed Interval Breakdown */}
            <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 text-xs sm:grid-cols-5">
              {dist.buckets.map((bucket) => (
                <div key={bucket.key} className="space-y-0.5">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-xs shrink-0"
                      style={{ backgroundColor: bucket.color }}
                      aria-hidden="true"
                    />
                    <span>Rentang {bucket.label}</span>
                  </div>
                  <p className="font-mono font-bold tabular-nums text-slate-900">
                    {bucket.count} siswa{' '}
                    <span className="font-normal text-slate-500">({bucket.pct}%)</span>
                  </p>
                </div>
              ))}
            </div>
          </div>
        )
      ) : (
        <div className="mt-5 space-y-3">
          <div className="h-72 w-full" data-testid="rombel-comparison-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={rombelComparisonData}
                margin={{ top: 16, right: 24, left: 4, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis
                  dataKey="rombelNama"
                  tick={{ fill: '#334155', fontSize: 12, fontWeight: 600 }}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fill: '#475569', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  width={38}
                />
                <ReferenceLine
                  y={dist.kktpThreshold}
                  stroke="#dc2626"
                  strokeDasharray="4 4"
                  label={{
                    value: `KKTP ${dist.kktpThreshold}`,
                    position: 'insideTopRight',
                    fill: '#dc2626',
                    fontSize: 11,
                  }}
                />
                <Tooltip
                  cursor={{ fill: '#f8fafc' }}
                  content={({ active, payload }) => {
                    if (!active || !payload || payload.length === 0) return null;
                    const row = payload[0].payload as (typeof rombelComparisonData)[number];
                    return (
                      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm">
                        <p className="font-bold text-slate-900">{row.rombelNama}</p>
                        <p className="mt-1 font-mono tabular-nums text-slate-700">
                          Rata-Rata: <strong className="text-blue-700">{row.rataRata.toFixed(1)}</strong> · Median: {row.median.toFixed(1)}
                        </p>
                        <p className="mt-0.5 font-mono tabular-nums text-slate-600">
                          Tuntas KKTP: {row.tuntasPct}% ({row.gradedStudents}/{row.totalStudents} siswa)
                        </p>
                      </div>
                    );
                  }}
                />
                <Bar
                  dataKey="rataRata"
                  name="Rata-Rata Nilai Rombel"
                  fill="#1d4ed8"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={58}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[11px] text-slate-500">
            Garis putus-putus merah menandai batas ketuntasan minimal (KKTP {dist.kktpThreshold}) untuk {dist.mapelNama}.
          </p>
        </div>
      )}
    </section>
  );
};
