"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type TaskCreateFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  properties: any[];
  clients: any[];
  services: any[];
  subscriptions: any[];
};

export default function TaskCreateForm({
  action,
  properties,
  clients,
  services,
  subscriptions,
}: TaskCreateFormProps) {
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [selectedServiceId, setSelectedServiceId] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");

  const filteredSubscriptions = useMemo(() => {
    if (!selectedPropertyId) return [];
    return subscriptions.filter(
      (subscription) => subscription.property_id === selectedPropertyId
    );
  }, [subscriptions, selectedPropertyId]);

  const selectedService = useMemo(() => {
    return services.find((service) => service.id === selectedServiceId) || null;
  }, [services, selectedServiceId]);

  useEffect(() => {
    if (!selectedService) return;

    if (!title.trim() && selectedService.default_title) {
      setTitle(selectedService.default_title);
    }

    if (!description.trim() && selectedService.default_description) {
      setDescription(selectedService.default_description);
    }

    if (
      (!priority || priority === "medium") &&
      selectedService.default_priority
    ) {
      setPriority(selectedService.default_priority);
    }
  }, [selectedService]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <form action={action} className="card space-y-6">
      <div className="grid grid-2 gap-4">
        <div>
          <label htmlFor="title" className="field-label">
            Title *
          </label>
          <input
            id="title"
            name="title"
            type="text"
            required
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div>
          <label htmlFor="property_id" className="field-label">
            Property *
          </label>
          <select
            id="property_id"
            name="property_id"
            required
            value={selectedPropertyId}
            onChange={(e) => setSelectedPropertyId(e.target.value)}
            className="input"
          >
            <option value="" disabled>
              Select property
            </option>
            {properties.map((property: any) => (
              <option key={property.id} value={property.id}>
                {property.property_code ? `${property.property_code} - ` : ""}
                {property.title}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="reported_by_client_id" className="field-label">
            Reported By
          </label>
          <select
            id="reported_by_client_id"
            name="reported_by_client_id"
            defaultValue=""
            className="input"
          >
            <option value="">Select client</option>
            {clients.map((client: any) => (
              <option key={client.id} value={client.id}>
                {client.company_name || client.full_name || "Unnamed Client"}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="assigned_to_client_id" className="field-label">
            Assigned To
          </label>
          <select
            id="assigned_to_client_id"
            name="assigned_to_client_id"
            defaultValue=""
            className="input"
          >
            <option value="">Select client</option>
            {clients.map((client: any) => (
              <option key={client.id} value={client.id}>
                {client.company_name || client.full_name || "Unnamed Client"}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="service_id" className="field-label">
            Service
          </label>
          <select
            id="service_id"
            name="service_id"
            value={selectedServiceId}
            onChange={(e) => setSelectedServiceId(e.target.value)}
            className="input"
          >
            <option value="">Select service</option>
            {services.map((service: any) => (
              <option key={service.id} value={service.id}>
                {service.name} {service.category ? `(${service.category})` : ""}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="subscription_id" className="field-label">
            Subscription
          </label>
          <select
            id="subscription_id"
            name="subscription_id"
            defaultValue=""
            className="input"
            disabled={!selectedPropertyId}
          >
            <option value="">
              {selectedPropertyId
                ? "Select subscription"
                : "Select property first"}
            </option>

            {filteredSubscriptions.map((subscription: any) => {
              const clientName =
                subscription.client?.company_name ||
                subscription.client?.full_name ||
                "Unknown Client";

              const propertyName =
                subscription.property?.property_code
                  ? `${subscription.property.property_code} - ${subscription.property?.title || ""}`
                  : subscription.property?.title || "Unknown Property";

              const packageName = subscription.package?.name || "No Package";

              return (
                <option key={subscription.id} value={subscription.id}>
                  {clientName} / {propertyName} / {packageName}
                </option>
              );
            })}
          </select>
        </div>

        <div>
          <label htmlFor="status" className="field-label">
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue="open"
            className="input"
          >
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <div>
          <label htmlFor="priority" className="field-label">
            Priority
          </label>
          <select
            id="priority"
            name="priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="input"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>

        <div>
          <label htmlFor="due_date" className="field-label">
            Due Date
          </label>
          <input
            id="due_date"
            name="due_date"
            type="date"
            className="input"
          />
        </div>

        <div className="col-span-2">
          <label htmlFor="description" className="field-label">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            rows={6}
            className="input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
      </div>

      <div className="flex gap-2">
        <Link href="/tasks" className="btn">
          Cancel
        </Link>
        <button type="submit" className="btn">
          Create Task
        </button>
      </div>
    </form>
  );
}