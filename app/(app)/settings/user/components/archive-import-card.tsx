"use client";

import { Card, CardBody, CardHeader } from "@heroui/react";

import ArchiveImporter from "@/components/navbar/archive-importer";

export default function ArchiveImportCard() {
  return (
    <Card>
      <CardHeader>
        <div>
          <h2 className="text-xl font-semibold">Import Recipe Archive</h2>
          <p className="text-default-500 mt-1 text-sm">
            Import recipes from Mela (.melarecipes), Mealie, or Tandoor (.zip) exports
          </p>
        </div>
      </CardHeader>
      <CardBody>
        <ArchiveImporter />
      </CardBody>
    </Card>
  );
}
