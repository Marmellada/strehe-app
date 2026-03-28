"use client";

export default function DeletePropertyButton() {
  function handleClick(
    e: React.MouseEvent<HTMLButtonElement, MouseEvent>
  ) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this property?"
    );

    if (!confirmed) {
      e.preventDefault();
    }
  }

  return (
    <button type="submit" className="btn" onClick={handleClick}>
      Delete
    </button>
  );
}