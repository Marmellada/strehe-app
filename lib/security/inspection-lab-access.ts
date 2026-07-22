export type InspectionLabIdentity = {
  id: string;
  role: string;
  isActive: boolean;
};

export class InspectionLabAccessDeniedError extends Error {
  constructor() {
    super("Inspection Lab access denied.");
    this.name = "InspectionLabAccessDeniedError";
  }
}

export function createInspectionLabAdminAccess<TAdminClient>(dependencies: {
  getIdentity: () => Promise<InspectionLabIdentity | null>;
  getAdminClient: () => TAdminClient;
}) {
  return async function requireInspectionLabAdmin() {
    const identity = await dependencies.getIdentity();

    if (!identity || !identity.isActive || identity.role !== "admin") {
      throw new InspectionLabAccessDeniedError();
    }

    return {
      appUser: identity,
      supabase: dependencies.getAdminClient(),
    };
  };
}
