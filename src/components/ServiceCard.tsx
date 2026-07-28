import Link from "next/link";

type ServiceCardProps = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  durationMins: number;
};

export function ServiceCard({
  id,
  name,
  description,
  price,
  durationMins,
}: ServiceCardProps) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{name}</h3>
          {description && (
            <p className="mt-1 text-sm text-gray-500">{description}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-4 text-sm text-gray-600">
        <span>${price.toFixed(2)}</span>
        <span className="text-gray-300">|</span>
        <span>{durationMins} min</span>
      </div>
      <Link
        href={`/book?serviceId=${id}`}
        className="mt-2 rounded-xl bg-pink-main px-4 py-2.5 text-center text-sm font-medium text-gray-900 transition-colors hover:bg-pink-light"
      >
        Agendar
      </Link>
    </div>
  );
}
