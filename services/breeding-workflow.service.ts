/**
 * Breeding → Pregnancy Check Workflow Service
 *
 * After a breeding record is saved, automatically creates a vaccination-record
 * reminder for a 30-day pregnancy check. The reminder appears in the
 * Vaccinations page under "Auto Generated" with Pending/Due/Overdue status
 * computed dynamically by lib/vaccination-status.ts.
 *
 * A second optional 60-day check is also created so the vet has a follow-up
 * reminder if the first scan is inconclusive.
 *
 * Cascade on update: if the breeding date changes, the reminder dates are
 * recalculated. On delete, pending reminders are removed.
 */

import { prisma } from "@/lib/db";

export const WORKFLOW_SOURCE = "breeding_workflow";

interface BreedingCheckMilestone {
  name: string;
  daysAfterBreeding: number;
  note: (breedingDateStr: string) => string;
}

const MILESTONES: BreedingCheckMilestone[] = [
  {
    name: "Pregnancy Check",
    daysAfterBreeding: 30,
    note: (d) =>
      `Auto-generated: First pregnancy check 30 days after breeding on ${d}. Perform rectal palpation or ultrasound to confirm conception.`,
  },
  {
    name: "Pregnancy Check (60 Day)",
    daysAfterBreeding: 60,
    note: (d) =>
      `Auto-generated: Confirmatory pregnancy check 60 days after breeding on ${d}. Verify fetal development and check for embryonic losses.`,
  },
];

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Called when a breeding record is created.
 * Creates 30-day and 60-day pregnancy check reminders for the female animal.
 */
export async function triggerWorkflow(
  breedingId: number,
  femaleAnimalId: number,
  breedingDate: Date,
): Promise<void> {
  const breedingDateStr = toDateOnly(breedingDate);

  const animal = await prisma.animals.findUnique({
    where: { animal_id: femaleAnimalId },
    select: { tag_number: true, animal_name: true },
  });
  const animalLabel = animal
    ? `#${animal.tag_number}${animal.animal_name ? ` (${animal.animal_name})` : ""}`
    : `Animal #${femaleAnimalId}`;

  const created: string[] = [];

  for (const milestone of MILESTONES) {
    const dueDate = addDays(breedingDate, milestone.daysAfterBreeding);

    const existing = await prisma.vaccination_records.findFirst({
      where: {
        breeding_id: breedingId,
        vaccine_name: milestone.name,
        source: WORKFLOW_SOURCE,
      },
    });
    if (existing) continue;

    await prisma.vaccination_records.create({
      data: {
        animal_id: femaleAnimalId,
        breeding_id: breedingId,
        vaccine_name: milestone.name,
        vaccination_date: null,
        next_due_date: dueDate,
        source: WORKFLOW_SOURCE,
        notes: milestone.note(breedingDateStr),
      },
    });

    created.push(`${milestone.name} on ${toDateOnly(dueDate)}`);
  }

  if (created.length === 0) return;

  const recipients = await prisma.users.findMany({
    where: { role: { in: ["ADMIN", "MANAGER", "VETERINARIAN"] }, is_active: true },
    select: { user_id: true },
  });

  const summary = created.join(" · ");
  const notifData = recipients.map((u) => ({
    user_id: u.user_id,
    type: "BREEDING_WORKFLOW",
    title: "Pregnancy Check Reminders Scheduled",
    message: `Breeding recorded for ${animalLabel} on ${breedingDateStr}. Auto-scheduled: ${summary}.`,
    entity_type: "breeding",
    entity_id: breedingId,
  }));

  if (notifData.length > 0) {
    await prisma.notifications.createMany({ data: notifData });
  }
}

/**
 * Called when a breeding record's date changes.
 * Recalculates due dates for all pending reminders linked to this breeding.
 */
export async function updateWorkflowDates(
  breedingId: number,
  newBreedingDate: Date,
): Promise<void> {
  const pending = await prisma.vaccination_records.findMany({
    where: {
      breeding_id: breedingId,
      source: WORKFLOW_SOURCE,
      vaccination_date: null,
    },
    select: { vaccination_id: true, vaccine_name: true },
  });

  for (const record of pending) {
    const milestone = MILESTONES.find((m) => m.name === record.vaccine_name);
    if (!milestone) continue;

    const newDueDate = addDays(newBreedingDate, milestone.daysAfterBreeding);
    await prisma.vaccination_records.update({
      where: { vaccination_id: record.vaccination_id },
      data: {
        next_due_date: newDueDate,
        notes: milestone.note(toDateOnly(newBreedingDate)),
      },
    });
  }
}

/**
 * Called when a breeding record is deleted.
 * Removes unadministered pregnancy check reminders.
 */
export async function cancelWorkflow(breedingId: number): Promise<number> {
  const { count } = await prisma.vaccination_records.deleteMany({
    where: {
      breeding_id: breedingId,
      source: WORKFLOW_SOURCE,
      vaccination_date: null,
    },
  });
  return count;
}
