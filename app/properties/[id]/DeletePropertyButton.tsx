"use client";

export default function DeletePropertyButton() {
  return (
    <button
      type="submit"
      className="btn btn-danger"
      onClick={(e) => {
        if (!confirm("Are you sure you want to delete this property?")) {
          e.preventDefault();
        }
      }}
    >
      Delete Property
    </button>
  );
}