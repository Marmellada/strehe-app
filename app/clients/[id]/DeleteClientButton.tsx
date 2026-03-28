"use client";

type DeleteClientButtonProps = {
  action: () => Promise<void>;
};

export default function DeleteClientButton({
  action,
}: DeleteClientButtonProps) {
  return (
    <form action={action}>
      <button
        type="submit"
        className="px-4 py-2 border rounded-md text-red-600"
        onClick={(e) => {
          const ok = window.confirm(
            "Are you sure you want to delete this client?"
          );

          if (!ok) {
            e.preventDefault();
          }
        }}
      >
        Delete Client
      </button>
    </form>
  );
}