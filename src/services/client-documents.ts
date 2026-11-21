/**
 * Documents + contracts of ONE customer — read-only (MCP `list_client_documents`,
 * the documents/contract line of `get_client`).
 *
 * Returns metadata only: never file contents, never contract sign tokens / sign URLs /
 * signed-PDF URLs. A document `url` is passed through only when it is a plain public
 * Vercel Blob URL (the same link the customer / pet card already shows).
 * Pure parsing + summary: `src/lib/client-documents.ts`.
 */
import prisma from "@/lib/prisma";
import { ServiceError } from "./types";
import {
  normalizeDocs,
  sortDocsNewestFirst,
  sortContractsNewestFirst,
  contractEffectiveStatus,
  contractSummary,
  isContractCategory,
  type ClientDocument,
  type ContractRow,
  type ContractEffectiveStatus,
  type ContractSummary,
} from "@/lib/client-documents";

export interface ClientContract extends ContractRow {
  effectiveStatus: ContractEffectiveStatus;
}

export interface ClientDocumentsResult {
  customer: { id: string; name: string };
  customerDocuments: ClientDocument[];
  /** Pet attachments + service-dog profile documents of the customer's dogs. */
  petDocuments: ClientDocument[];
  contracts: ClientContract[];
  summary: ContractSummary & {
    customerDocCount: number;
    petDocCount: number;
    /** Customer-card documents uploaded manually as a contract / agreement. */
    uploadedContractDocCount: number;
  };
}

export async function getClientDocuments(
  businessId: string,
  customerId: string,
  now: Date = new Date()
): Promise<ClientDocumentsResult> {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, businessId },
    select: { id: true, name: true, documents: true },
  });
  if (!customer) throw new ServiceError("לקוח לא נמצא", "NOT_FOUND");

  const [pets, contractRows] = await Promise.all([
    prisma.pet.findMany({
      where: { customerId: customer.id },
      select: {
        id: true,
        name: true,
        attachments: true,
        serviceDogProfile: { select: { businessId: true, documents: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.contractRequest.findMany({
      where: { businessId, customerId: customer.id },
      select: {
        id: true,
        status: true,
        createdAt: true,
        sentAt: true,
        openedAt: true,
        signedAt: true,
        expiresAt: true,
        signedFileUrl: true,
        template: { select: { name: true } },
        pet: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  const customerDocuments = sortDocsNewestFirst(normalizeDocs(customer.documents, "customer"));

  const petDocuments: ClientDocument[] = [];
  for (const p of pets) {
    const pet = { id: p.id, name: p.name };
    petDocuments.push(...normalizeDocs(p.attachments, "pet", pet));
    if (p.serviceDogProfile && p.serviceDogProfile.businessId === businessId) {
      petDocuments.push(...normalizeDocs(p.serviceDogProfile.documents, "service_dog", pet));
    }
  }

  const contracts: ClientContract[] = sortContractsNewestFirst(
    contractRows.map((r) => {
      const row: ContractRow = {
        id: r.id,
        status: r.status,
        templateName: r.template?.name ?? null,
        petName: r.pet?.name ?? null,
        createdAt: r.createdAt,
        sentAt: r.sentAt,
        openedAt: r.openedAt,
        signedAt: r.signedAt,
        expiresAt: r.expiresAt,
        hasSignedFile: !!r.signedFileUrl,
      };
      return { ...row, effectiveStatus: contractEffectiveStatus(row, now) };
    })
  );

  return {
    customer: { id: customer.id, name: customer.name },
    customerDocuments,
    petDocuments: sortDocsNewestFirst(petDocuments),
    contracts,
    summary: {
      ...contractSummary(contracts, now),
      customerDocCount: customerDocuments.length,
      petDocCount: petDocuments.length,
      uploadedContractDocCount: customerDocuments.filter((d) => isContractCategory(d.category)).length,
    },
  };
}
