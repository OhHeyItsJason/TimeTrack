import React from "react";
import { Navigate } from "react-router-dom";

export default function InvoiceHistoryRedirect() {
  return <Navigate to="/Invoice?tab=history" replace />;
}
