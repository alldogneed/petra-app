"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PawPrint, Plus } from "lucide-react";
import { toast } from "sonner";
import { fetchJSON } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal";
import { PetCard, type PetCardActions } from "./PetCard";
import { EditBehaviorModal, EditFeedingModal, EditHealthModal } from "./pet-care-modals";
import { AddPetModal, EditPetModal, EditPetNoteModal, MedicationModal, PetDocumentsModal } from "./pet-modals";
import type { CustomerDetail, DogMedication, Pet } from "./types";

type NoteField = "medicalNotes" | "behaviorNotes";

export function PetsSection({
  customer,
  isGroomer,
  canSendMessages,
  canDelete,
  deleteIsRequest,
}: {
  customer: CustomerDetail;
  isGroomer: boolean;
  canSendMessages: boolean;
  /** Delete button visible (direct delete, or a manager's approval request). */
  canDelete: boolean;
  deleteIsRequest: boolean;
}) {
  const customerId = customer.id;
  const queryClient = useQueryClient();
  const [expandedPetId, setExpandedPetId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [docsPet, setDocsPet] = useState<Pet | null>(null);
  const [medModal, setMedModal] = useState<{ pet: Pet; med: DogMedication | null } | null>(null);
  const [deletingMed, setDeletingMed] = useState<{ petId: string; id: string; name: string } | null>(null);
  const [healthPet, setHealthPet] = useState<Pet | null>(null);
  const [behaviorPet, setBehaviorPet] = useState<Pet | null>(null);
  const [feedingPet, setFeedingPet] = useState<Pet | null>(null);
  const [noteModal, setNoteModal] = useState<{ petId: string; field: NoteField; label: string; value: string } | null>(null);
  const [editPet, setEditPet] = useState<Pet | null>(null);
  const [deletingPet, setDeletingPet] = useState<Pet | null>(null);

  const invalidateCustomer = () => queryClient.invalidateQueries({ queryKey: ["customer", customerId] });

  const deleteMedMutation = useMutation({
    mutationFn: ({ petId, id }: { petId: string; id: string }) =>
      fetchJSON(`/api/pets/${petId}/medications/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      invalidateCustomer();
      setDeletingMed(null);
      toast.success("התרופה נמחקה");
    },
    onError: (e: Error) => {
      setDeletingMed(null);
      toast.error(e.message || "שגיאה במחיקת התרופה");
    },
  });

  // Always sent after the typed confirmation. The server answers 202 pendingApproval
  // for a manager without CRITICAL_DELETE, or deletes when the confirm header matches.
  const deletePetMutation = useMutation<Record<string, unknown>, Error, string>({
    mutationFn: (petId) =>
      fetchJSON(`/api/pets/${petId}`, {
        method: "DELETE",
        headers: { "x-confirm-action": `DELETE_PET_${petId}` },
      }) as Promise<Record<string, unknown>>,
    onSuccess: (data) => {
      setDeletingPet(null);
      if (data?.pendingApproval) {
        toast.success("הבקשה נשלחה לאישור הבעלים");
        return;
      }
      invalidateCustomer();
      // Pets list + customers list cache the pet under the global staleTime.
      queryClient.invalidateQueries({ queryKey: ["pets-all"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.success("חיית המחמד נמחקה");
    },
    onError: (err) => {
      setDeletingPet(null);
      toast.error(err?.message || "שגיאה במחיקת חיית המחמד");
    },
  });

  const actions: PetCardActions = {
    onEdit: (pet) => setEditPet(pet),
    onDelete: (pet) => setDeletingPet(pet),
    onFeeding: (pet) => setFeedingPet(pet),
    onMedication: (pet, med) => setMedModal({ pet, med }),
    onDeleteMedication: (pet, med) => setDeletingMed({ petId: pet.id, id: med.id, name: med.medName }),
    onHealth: (pet) => setHealthPet(pet),
    onBehavior: (pet) => setBehaviorPet(pet),
    onNote: (pet, field, label, value) => setNoteModal({ petId: pet.id, field, label, value }),
    onDocuments: (pet) => setDocsPet(pet),
  };

  return (
    <div id="pets" className="card p-5 scroll-mt-32">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold text-petra-text">
          חיות מחמד ({customer.summary?.counts.pets ?? customer.pets.length})
        </h2>
        <button className="btn-ghost text-xs" onClick={() => setShowAdd(true)}>
          <Plus className="w-3.5 h-3.5" />
          הוסף
        </button>
      </div>

      {customer.pets.length === 0 ? (
        <div className="empty-state py-8">
          <PawPrint className="empty-state-icon w-8 h-8" />
          <p className="text-sm text-petra-muted mt-2">אין חיות מחמד רשומות</p>
          <button className="btn-primary mt-3 text-xs" onClick={() => setShowAdd(true)}>
            <Plus className="w-3.5 h-3.5" />
            הוסף חיית מחמד
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {customer.pets.map((pet) => (
            <PetCard
              key={pet.id}
              pet={pet}
              programs={(customer.trainingPrograms || []).filter((p) => p.dogId === pet.id)}
              customerPhone={customer.phone}
              isGroomer={isGroomer}
              isExpanded={expandedPetId === pet.id}
              onToggle={() => setExpandedPetId((cur) => (cur === pet.id ? null : pet.id))}
              canSendMessages={canSendMessages}
              canDelete={canDelete}
              deleteIsRequest={deleteIsRequest}
              actions={actions}
            />
          ))}
        </div>
      )}

      {showAdd && <AddPetModal customerId={customerId} isOpen onClose={() => setShowAdd(false)} />}
      {docsPet && (
        <PetDocumentsModal petId={docsPet.id} petName={docsPet.name} customerId={customerId} isOpen onClose={() => setDocsPet(null)} />
      )}
      {medModal && (
        <MedicationModal
          petId={medModal.pet.id}
          petName={medModal.pet.name}
          med={medModal.med}
          customerId={customerId}
          onClose={() => setMedModal(null)}
        />
      )}
      {healthPet && (
        <EditHealthModal
          petId={healthPet.id}
          petName={healthPet.name}
          health={healthPet.health}
          customerId={customerId}
          onClose={() => setHealthPet(null)}
        />
      )}
      {behaviorPet && (
        <EditBehaviorModal
          petId={behaviorPet.id}
          petName={behaviorPet.name}
          behavior={behaviorPet.behavior}
          customerId={customerId}
          onClose={() => setBehaviorPet(null)}
        />
      )}
      {feedingPet && (
        <EditFeedingModal
          petId={feedingPet.id}
          petName={feedingPet.name}
          pet={feedingPet}
          customerId={customerId}
          onClose={() => setFeedingPet(null)}
        />
      )}
      {noteModal && (
        <EditPetNoteModal
          petId={noteModal.petId}
          field={noteModal.field}
          label={noteModal.label}
          value={noteModal.value}
          customerId={customerId}
          onClose={() => setNoteModal(null)}
        />
      )}
      {editPet && <EditPetModal pet={editPet} customerId={customerId} onClose={() => setEditPet(null)} />}

      <ConfirmDialog
        open={!!deletingMed}
        title="מחיקת תרופה"
        description={deletingMed ? `למחוק את ${deletingMed.name}? פעולה זו אינה הפיכה.` : undefined}
        confirmLabel="מחק"
        danger
        loading={deleteMedMutation.isPending}
        onCancel={() => setDeletingMed(null)}
        onConfirm={() => deletingMed && deleteMedMutation.mutate({ petId: deletingMed.petId, id: deletingMed.id })}
      />

      {deletingPet && (
        <ConfirmDeleteModal
          open
          onClose={() => setDeletingPet(null)}
          onConfirm={() => deletePetMutation.mutate(deletingPet.id)}
          title={deleteIsRequest ? "בקשת מחיקת חיית מחמד" : "מחיקת חיית מחמד"}
          confirmText={deletingPet.name}
          description={
            deleteIsRequest
              ? `הבקשה למחיקת ${deletingPet.name} תישלח לאישור הבעלים לפני ביצוע המחיקה.`
              : `מחיקת ${deletingPet.name} תסיר את כל הנתונים הרפואיים, המשקל וההיסטוריה המשויכים. פעולה זו אינה ניתנת לביטול.`
          }
          loading={deletePetMutation.isPending}
        />
      )}
    </div>
  );
}
