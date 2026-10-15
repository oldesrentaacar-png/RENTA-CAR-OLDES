"use client";

import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";

export function PrintStatementButton() {
  return (
    <Button
      type="button"
      variant="secondary"
      className="print:hidden"
      onClick={() => window.print()}
    >
      <Printer className="mr-2 h-4 w-4" />
      Imprimir estado de cuenta
    </Button>
  );
}
