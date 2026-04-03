import { createClient } from "@/lib/supabase/server";

type ServiceRelation =
  | {
      id: string;
      name: string | null;
      description: string | null;
      default_priority: string | null;
      default_title: string | null;
      default_description: string | null;
      is_active: boolean | null;
    }
  | {
      id: string;
      name: string | null;
      description: string | null;
      default_priority: string | null;
      default_title: string | null;
      default_description: string | null;
      is_active: boolean | null;
    }[]
  | null;

type PackageServiceRow = {
  id: string;
  package_id: string;
  service_id: string;
  included_quantity: number | null;
  service: ServiceRelation;
};

type SubscriptionRow = {
  id: string;
  client_id: string;
  property_id: string;
  package_id: string;
  start_date: string;
  end_date: string | null;
  status: string | null;
};

function getSingleRelation<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] || null;
  return value;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function formatDateOnly(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(
    date.getDate()
  )}`;
}

function parseDateOnly(value: string | null | undefined) {
  if (!value) return null;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  return new Date(year, month - 1, day);
}

function normalizePriority(value: string | null | undefined) {
  const priority = (value || "").toLowerCase();

  if (
    priority === "low" ||
    priority === "medium" ||
    priority === "high" ||
    priority === "urgent"
  ) {
    return priority;
  }

  return "medium";
}

function isSubscriptionActiveOnDate(subscription: SubscriptionRow, date: Date) {
  const status = (subscription.status || "").toLowerCase();

  if (status !== "active" && status !== "paused") {
    return false;
  }

  const checkDate = startOfDay(date);
  const startDate = parseDateOnly(subscription.start_date);

  if (!startDate) {
    return false;
  }

  const normalizedStart = startOfDay(startDate);

  if (normalizedStart > checkDate) {
    return false;
  }

  if (subscription.end_date) {
    const endDate = parseDateOnly(subscription.end_date);

    if (endDate) {
      const normalizedEnd = startOfDay(endDate);

      if (normalizedEnd < checkDate) {
        return false;
      }
    }
  }

  return true;
}

function buildPlannedDueDatesInWindow(params: {
  subscriptionStartDate: string;
  tasksPerMonth: number;
  windowStart: Date;
  windowEnd: Date;
  subscriptionEndDate?: string | null;
}) {
  const {
    subscriptionStartDate,
    tasksPerMonth,
    windowStart,
    windowEnd,
    subscriptionEndDate,
  } = params;

  if (!Number.isInteger(tasksPerMonth) || tasksPerMonth <= 0) {
    return [];
  }

  const start = parseDateOnly(subscriptionStartDate);
  if (!start) {
    return [];
  }

  const normalizedStart = startOfDay(start);

  const endLimit = subscriptionEndDate
    ? parseDateOnly(subscriptionEndDate)
    : null;

  const normalizedEndLimit = endLimit ? startOfDay(endLimit) : null;

  const results: string[] = [];
  let cycleIndex = 0;
  const hardLimit = 240;

  while (cycleIndex < hardLimit) {
    const cycleStart = new Date(
      normalizedStart.getFullYear(),
      normalizedStart.getMonth() + cycleIndex,
      normalizedStart.getDate()
    );

    const nextCycleStart = new Date(
      normalizedStart.getFullYear(),
      normalizedStart.getMonth() + cycleIndex + 1,
      normalizedStart.getDate()
    );

    const cycleLengthDays = Math.max(
      1,
      Math.round(
        (startOfDay(nextCycleStart).getTime() -
          startOfDay(cycleStart).getTime()) /
          (1000 * 60 * 60 * 24)
      )
    );

    if (cycleStart > windowEnd) {
      break;
    }

    for (let i = 0; i < tasksPerMonth; i++) {
      let dueDate: Date;

      if (tasksPerMonth === 1) {
        dueDate = startOfDay(cycleStart);
      } else {
        const offsetDays = Math.floor((i * cycleLengthDays) / tasksPerMonth);
        dueDate = startOfDay(addDays(cycleStart, offsetDays));
      }

      if (dueDate < normalizedStart) {
        continue;
      }

      if (normalizedEndLimit && dueDate > normalizedEndLimit) {
        continue;
      }

      if (dueDate < windowStart || dueDate > windowEnd) {
        continue;
      }

      results.push(formatDateOnly(dueDate));
    }

    cycleIndex += 1;
  }

  return [...new Set(results)].sort();
}

export async function generateTasks(referenceDate = new Date()) {
  const supabase = await createClient();

  const runDate = startOfDay(referenceDate);
  const windowStart = runDate;
  const windowEnd = addDays(runDate, 13);

  const { data: subscriptions, error: subscriptionsError } = await supabase
    .from("subscriptions")
    .select(
      `
      id,
      client_id,
      property_id,
      package_id,
      start_date,
      end_date,
      status
    `
    );

  if (subscriptionsError) {
    throw new Error(`Failed to load subscriptions: ${subscriptionsError.message}`);
  }

  const eligibleSubscriptions = ((subscriptions || []) as SubscriptionRow[]).filter(
    (subscription) =>
      isSubscriptionActiveOnDate(subscription, windowStart) ||
      isSubscriptionActiveOnDate(subscription, windowEnd)
  );

  let createdCount = 0;
  let skippedDuplicateCount = 0;
  let skippedInactiveServiceCount = 0;
  let skippedInvalidPackageServiceCount = 0;
  let skippedNoDueDatesCount = 0;

  for (const subscription of eligibleSubscriptions) {
    const { data: packageServices, error: packageServicesError } = await supabase
      .from("package_services")
      .select(
        `
        id,
        package_id,
        service_id,
        included_quantity,
        service:services!package_services_service_fk (
          id,
          name,
          description,
          default_priority,
          default_title,
          default_description,
          is_active
        )
      `
      )
      .eq("package_id", subscription.package_id);

    if (packageServicesError) {
      throw new Error(
        `Failed to load package services for subscription ${subscription.id}: ${packageServicesError.message}`
      );
    }

    const rows = (packageServices || []) as PackageServiceRow[];

    for (const row of rows) {
      const service = getSingleRelation(row.service);
      const tasksPerMonth = Number(row.included_quantity || 0);

      if (!service || !service.id || tasksPerMonth <= 0) {
        skippedInvalidPackageServiceCount += 1;
        continue;
      }

      if (!service.is_active) {
        skippedInactiveServiceCount += 1;
        continue;
      }

      const dueDatesInWindow = buildPlannedDueDatesInWindow({
        subscriptionStartDate: subscription.start_date,
        subscriptionEndDate: subscription.end_date,
        tasksPerMonth,
        windowStart,
        windowEnd,
      });

      if (dueDatesInWindow.length === 0) {
        skippedNoDueDatesCount += 1;
        continue;
      }

      const title =
        service.default_title?.trim() ||
        service.name?.trim() ||
        "Service Task";

      const description =
        service.default_description?.trim() ||
        service.description?.trim() ||
        null;

      const priority = normalizePriority(service.default_priority);

      for (const dueDate of dueDatesInWindow) {
        const { data: existingTask, error: existingTaskError } = await supabase
          .from("tasks")
          .select("id")
          .eq("subscription_id", subscription.id)
          .eq("service_id", service.id)
          .eq("due_date", dueDate)
          .maybeSingle();

        if (existingTaskError) {
          throw new Error(
            `Failed to check existing task for subscription ${subscription.id}: ${existingTaskError.message}`
          );
        }

        if (existingTask) {
          skippedDuplicateCount += 1;
          continue;
        }

        const { error: insertError } = await supabase.from("tasks").insert({
          title,
          description,
          property_id: subscription.property_id,
          reported_by_client_id: subscription.client_id,
          status: "open",
          priority,
          due_date: dueDate,
          service_id: service.id,
          subscription_id: subscription.id,
        });

        if (insertError) {
          throw new Error(
            `Failed to create task for subscription ${subscription.id}: ${insertError.message}`
          );
        }

        createdCount += 1;
      }
    }
  }

  return {
    runDate: formatDateOnly(runDate),
    windowStart: formatDateOnly(windowStart),
    windowEnd: formatDateOnly(windowEnd),
    eligibleSubscriptions: eligibleSubscriptions.length,
    createdCount,
    skippedDuplicateCount,
    skippedInactiveServiceCount,
    skippedInvalidPackageServiceCount,
    skippedNoDueDatesCount,
  };
}