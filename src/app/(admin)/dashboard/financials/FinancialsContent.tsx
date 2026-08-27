"use client";

import { useState, useEffect, useCallback } from "react";

type PnLBreakdownItem = {
  serviceName: string;
  amount: number;
  count: number;
};

type PnLResult = {
  month: string;
  recaudacion: {
    income: number;
    servicesCount: number;
    incomeByService: PnLBreakdownItem[];
  };
  produccion: {
    income: number;
    servicesCount: number;
    incomeByService: PnLBreakdownItem[];
  };
  expenses: number;
  profitRecaudacion: number;
  profitProduccion: number;
  invoicesCount: number;
  expensesByCategory: { categoryName: string; amount: number }[];
};

const defaultMonth = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Caracas",
  year: "numeric",
  month: "2-digit",
}).format(new Date());

function PnLPanel({
  title,
  income,
  profit,
  servicesCount,
  incomeByService,
  emptyMessage,
}: {
  title: string;
  income: number;
  profit: number;
  servicesCount: number;
  incomeByService: PnLBreakdownItem[];
  emptyMessage: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-semibold text-gray-900">{title}</p>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <p className="text-2xl font-bold text-green-600">${income.toFixed(2)}</p>
        <p className={`text-sm font-semibold ${profit >= 0 ? "text-green-600" : "text-red-600"}`}>
          Utilidad ${profit.toFixed(2)}
        </p>
        <p className="text-xs text-gray-400">{servicesCount} servicios</p>
      </div>
      <p className="mt-4 text-xs font-medium uppercase tracking-wide text-gray-400">Ingresos por servicio</p>
      {incomeByService.length === 0 ? (
        <p className="mt-2 text-sm text-gray-400">{emptyMessage}</p>
      ) : (
        <div className="mt-2 space-y-2">
          {incomeByService.map((s) => (
            <div key={s.serviceName} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
              <p className="text-sm text-gray-700">
                {s.serviceName} <span className="text-xs text-gray-400">({s.count})</span>
              </p>
              <p className="text-sm font-semibold text-gray-900">${s.amount.toFixed(2)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function FinancialsContent() {
  const [month, setMonth] = useState(defaultMonth);
  const [data, setData] = useState<PnLResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/financials/pnl?month=${month}`);
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || "No se pudo cargar el estado financiero");
      }
      setData(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    void load();
  }, [load]);

  const cardCls = "rounded-xl border border-gray-200 bg-white p-4 shadow-sm";

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Estados financieros</h1>
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-pink-main focus:outline-none"
        />
      </div>

      {loading && !data ? (
        <p className="text-gray-400">Cargando...</p>
      ) : error ? (
        <div className="rounded-xl border-2 border-dashed border-red-200 p-12 text-center">
          <p className="text-red-500">{error}</p>
        </div>
      ) : data ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className={cardCls}>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Gastos</p>
              <p className="mt-1 text-xl font-bold text-red-600">${data.expenses.toFixed(2)}</p>
              <p className="mt-1 text-xs text-gray-400">{data.invoicesCount} facturas</p>
            </div>
            <div className={cardCls}>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Utilidad (recaudación)</p>
              <p
                className={`mt-1 text-xl font-bold ${data.profitRecaudacion >= 0 ? "text-green-600" : "text-red-600"}`}
              >
                ${data.profitRecaudacion.toFixed(2)}
              </p>
            </div>
            <div className={cardCls}>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Utilidad (producción)</p>
              <p
                className={`mt-1 text-xl font-bold ${data.profitProduccion >= 0 ? "text-green-600" : "text-red-600"}`}
              >
                ${data.profitProduccion.toFixed(2)}
              </p>
            </div>
            <div className={cardCls}>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Facturas</p>
              <p className="mt-1 text-xl font-bold text-gray-900">{data.invoicesCount}</p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <PnLPanel
              title="Recaudación (caja)"
              income={data.recaudacion.income}
              profit={data.profitRecaudacion}
              servicesCount={data.recaudacion.servicesCount}
              incomeByService={data.recaudacion.incomeByService}
              emptyMessage="Sin ingresos en este mes"
            />
            <PnLPanel
              title="Producción (completadas)"
              income={data.produccion.income}
              profit={data.profitProduccion}
              servicesCount={data.produccion.servicesCount}
              incomeByService={data.produccion.incomeByService}
              emptyMessage="Sin servicios completados en este mes"
            />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className={cardCls}>
              <p className="mb-3 text-sm font-semibold text-gray-900">Gastos por categoría</p>
              {data.expensesByCategory.length === 0 ? (
                <p className="text-sm text-gray-400">Sin gastos en este mes</p>
              ) : (
                <div className="space-y-2">
                  {data.expensesByCategory.map((c) => (
                    <div key={c.categoryName} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                      <p className="text-sm text-gray-700">{c.categoryName}</p>
                      <p className="text-sm font-semibold text-gray-900">${c.amount.toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}