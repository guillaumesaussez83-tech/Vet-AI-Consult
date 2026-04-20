import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine, Dot,
} from "recharts";
import { format, parseISO, isValid } from "date-fns";
import { fr } from "date-fns/locale";
import { TrendingUp, TrendingDown, Minus, Scale } from "lucide-react";

interface WeightPoint {
  date: string;
  poids: number;
  motif?: string | null;
}

interface Props {
  consultations: any[];
}

function parseDateSafe(d: string | undefined | null): Date | null {
  if (!d) return null;
  const p = parseISO(d);
  return isValid(p) ? p : null;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload as WeightPoint;
  return (
    <div className="bg-popover border rounded-lg shadow-lg px-3 py-2 text-sm">
      <p className="font-semibold text-foreground">{point.poids} kg</p>
      <p className="text-muted-foreground text-xs">{label}</p>
      {point.motif && (
        <p className="text-muted-foreground text-xs mt-0.5 max-w-36 truncate">{point.motif}</p>
      )}
    </div>
  );
};

const CustomDot = (props: any) => {
  const { cx, cy, payload } = props;
  return (
    <Dot
      cx={cx}
      cy={cy}
      r={4}
      fill="hsl(var(--primary))"
      stroke="hsl(var(--background))"
      strokeWidth={2}
    />
  );
};

export function WeightChart({ consultations }: Props) {
  const data: WeightPoint[] = (consultations ?? [])
    .filter(c => c.poids != null && c.poids > 0)
    .map(c => ({
      date: c.date,
      poids: parseFloat(c.poids),
      motif: c.motif,
    }))
    .sort((a, b) => {
      const da = parseDateSafe(a.date);
      const db = parseDateSafe(b.date);
      if (!da || !db) return 0;
      return da.getTime() - db.getTime();
    })
    .map(c => ({
      ...c,
      date: (() => {
        const d = parseDateSafe(c.date);
        return d ? format(d, "dd/MM/yy", { locale: fr }) : c.date;
      })(),
    }));

  if (data.length < 2) {
    return (
      <div className="flex items-center gap-3 py-4 px-3 bg-muted/30 rounded-lg">
        <Scale className="h-5 w-5 text-muted-foreground opacity-40 flex-shrink-0" />
        <p className="text-sm text-muted-foreground">
          {data.length === 0
            ? "Aucune mesure de poids enregistrée — saisissez le poids lors des consultations."
            : "Au moins 2 mesures nécessaires pour afficher l'évolution du poids."}
        </p>
      </div>
    );
  }

  const first = data[0].poids;
  const last = data[data.length - 1].poids;
  const diff = last - first;
  const pct = ((diff / first) * 100).toFixed(1);
  const minPoids = Math.min(...data.map(d => d.poids));
  const maxPoids = Math.max(...data.map(d => d.poids));
  const yMin = Math.floor(minPoids * 0.95 * 10) / 10;
  const yMax = Math.ceil(maxPoids * 1.05 * 10) / 10;
  const meanPoids = data.reduce((s, d) => s + d.poids, 0) / data.length;

  const TrendIcon = diff > 0.2 ? TrendingUp : diff < -0.2 ? TrendingDown : Minus;
  const trendColor =
    diff > 0.5 ? "text-amber-600" :
    diff < -0.5 ? "text-red-600" :
    "text-green-600";

  return (
    <div className="space-y-3">
      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="bg-muted/40 rounded-lg py-2 px-3">
          <p className="text-xs text-muted-foreground">Actuel</p>
          <p className="font-bold text-sm">{last} kg</p>
        </div>
        <div className="bg-muted/40 rounded-lg py-2 px-3">
          <p className="text-xs text-muted-foreground">Min / Max</p>
          <p className="font-bold text-sm">{minPoids} / {maxPoids} kg</p>
        </div>
        <div className={`bg-muted/40 rounded-lg py-2 px-3 flex flex-col items-center`}>
          <p className="text-xs text-muted-foreground">Évolution</p>
          <div className={`flex items-center gap-1 font-bold text-sm ${trendColor}`}>
            <TrendIcon className="h-3.5 w-3.5" />
            {diff >= 0 ? "+" : ""}{diff.toFixed(1)} kg
          </div>
          <p className="text-[10px] text-muted-foreground">{pct}%</p>
        </div>
      </div>

      {/* Chart */}
      <div className="h-36 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" opacity={0.4} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={[yMin, yMax]}
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={v => `${v}`}
              unit=" kg"
              width={48}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine
              y={meanPoids}
              stroke="hsl(var(--muted-foreground))"
              strokeDasharray="4 4"
              opacity={0.4}
            />
            <Line
              type="monotone"
              dataKey="poids"
              stroke="hsl(var(--primary))"
              strokeWidth={2.5}
              dot={<CustomDot />}
              activeDot={{ r: 6, fill: "hsl(var(--primary))", stroke: "hsl(var(--background))", strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <p className="text-[10px] text-muted-foreground text-right">
        {data.length} mesure{data.length > 1 ? "s" : ""} • ligne pointillée = moyenne ({meanPoids.toFixed(1)} kg)
      </p>
    </div>
  );
}
