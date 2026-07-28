type Props = {
  totalVisits: number;
  totalRevenue: number;
};

export function StatsBanner({ totalVisits, totalRevenue }: Props) {
  return (
    <div className="flex gap-4">
      <div className="flex-1 rounded-xl bg-pink-light p-4 text-center">
        <p className="text-3xl font-bold text-gray-900">{totalVisits}</p>
        <p className="mt-1 text-sm text-gray-500">Visitas</p>
      </div>
      <div className="flex-1 rounded-xl bg-pink-light p-4 text-center">
        <p className="text-3xl font-bold text-gray-900">
          ${totalRevenue.toFixed(2)}
        </p>
        <p className="mt-1 text-sm text-gray-500">Invertido</p>
      </div>
    </div>
  );
}
