import React from "react";
import { useSearchParams } from "react-router-dom";
import Invoice from "./Invoice";
import InvoiceHistory from "./InvoiceHistory";

const TABS = {
  create: {
    label: "Create",
    description: "Prepare an invoice from tracked work",
  },
  history: {
    label: "History",
    description: "Review, manage, and track invoices",
  },
};

export default function Invoices() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") === "history" ? "history" : "create";

  const selectTab = (tab) => {
    setSearchParams(tab === "history" ? { tab } : {});
  };

  return (
    <div className="min-h-screen bg-[#f2f2f7] p-4 pb-24 md:p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-7">
          <h1 className="text-4xl font-semibold tracking-tight text-gray-900 md:text-5xl">Invoices</h1>
          <p className="mt-2 text-lg text-gray-500">{TABS[activeTab].description}</p>
        </div>

        <div className="mt-10" role="tablist" aria-label="Invoices">
          <div className="flex items-end gap-2">
            {Object.entries(TABS).map(([tab, item]) => {
              const isActive = activeTab === tab;

              return (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => selectTab(tab)}
                  className={`-mb-px flex h-[52px] w-36 items-center border px-8 pt-3 text-left text-sm font-semibold transition-colors sm:w-44 ${
                    isActive
                      ? "border-blue-600 bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                      : "border-gray-200 bg-white text-gray-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                  }`}
                  style={{ clipPath: "polygon(0 16px, 18px 16px, 28px 0, 98px 0, 108px 16px, 100% 16px, 100% 100%, 0 100%)" }}
                >
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          <div className="relative rounded-b-[26px] border border-t-0 border-gray-200 bg-white p-4 shadow-lg shadow-gray-200/50 md:p-6">
          <div hidden={activeTab !== "create"}>
            <Invoice embedded />
          </div>
          <div hidden={activeTab !== "history"}>
            <InvoiceHistory embedded />
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}
