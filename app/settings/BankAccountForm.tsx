"use client";

type Bank = {
  id: string;
  name: string | null;
  swift_code: string | null;
};

type Props = {
  banks: Bank[];
  action: (formData: FormData) => void | Promise<void>;
};

export default function BankAccountForm({ banks, action }: Props) {
  return (
    <form action={action} className="space-y-4">
      <div className="grid grid-2 gap-4">
        <div>
          <label htmlFor="bank_id" className="field-label">
            Bank *
          </label>
          <select
            id="bank_id"
            name="bank_id"
            defaultValue=""
            className="input"
            required
          >
            <option value="" disabled>
              Select bank
            </option>
            {banks.map((bank) => (
              <option key={bank.id} value={bank.id}>
                {bank.name}
                {bank.swift_code ? ` (${bank.swift_code})` : ""}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="account_name" className="field-label">
            Account Name *
          </label>
          <input
            id="account_name"
            name="account_name"
            className="input"
            placeholder="e.g. STREHË PRONA SHPK"
            required
            style={{ textTransform: "uppercase" }}
            onChange={(e) => {
              e.currentTarget.value = e.currentTarget.value.toUpperCase();
            }}
          />
        </div>

        <div>
          <label htmlFor="iban" className="field-label">
            IBAN *
          </label>
          <input
            id="iban"
            name="iban"
            className="input"
            placeholder="e.g. XK051212012345678906"
            required
            style={{ textTransform: "uppercase" }}
            onChange={(e) => {
              e.currentTarget.value = e.currentTarget.value.toUpperCase();
            }}
          />
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "end",
          }}
        >
          <label
            className="flex items-center gap-3"
            style={{ cursor: "pointer" }}
          >
            <input type="checkbox" name="is_primary" />
            <span className="field-label" style={{ margin: 0 }}>
              Set as primary
            </span>
          </label>
        </div>
      </div>

      <div>
        <button type="submit" className="btn btn-primary">
          Add Bank Account
        </button>
      </div>
    </form>
  );
}