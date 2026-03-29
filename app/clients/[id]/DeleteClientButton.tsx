"use client";

export default function DeleteClientButton() {
  return (
    <button
      type="submit"
      className="btn btn-danger"
      onClick={(e) => {
        if (!confirm("Are you sure you want to delete this client?")) {
          e.preventDefault();
        }
      }}
    >
      Delete Client
    </button>
  );
}