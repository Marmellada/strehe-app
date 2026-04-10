"use client";

import { type ReactNode, useState } from "react";
import {
  CircleAlert,
  Eye,
  EyeOff,
  Info,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import {
  Alert,
  AppearancePreviewPanel,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  DetailField,
  EmptyState,
  FormInput,
  Input,
  Label,
  ListToolbar,
  PageHeader,
  SectionCard,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  StatCard,
  StatusBadge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableShell,
  Textarea,
} from "@/components/ui";

const globalControlRows = [
  {
    element: "Shell / page chrome",
    controls:
      "page background, sidebar background/text/labels/links, topbar background/text",
  },
  {
    element: "Buttons",
    controls:
      "primary, secondary, outline, ghost, and destructive button families separately",
  },
  {
    element: "Fields",
    controls:
      "input, textarea, and select families separately",
  },
  {
    element: "Checkbox",
    controls:
      "checkbox background, border, focus ring, checked fill, checked border, and checkmark",
  },
  {
    element: "Cards",
    controls: "surface color, border color, title color, muted text color, radius, shadow",
  },
  {
    element: "Tables",
    controls:
      "table header background/text, body text, row border color, action button visuals",
  },
  {
    element: "Badges / status pills",
    controls: "success, warning, danger, info, neutral palette",
  },
  {
    element: "Alerts / helper surfaces",
    controls:
      "default, info, success, warning, and destructive alert families separately",
  },
  {
    element: "Empty states",
    controls:
      "empty-state background, dashed border, icon surface, and icon color",
  },
  {
    element: "Typography",
    controls: "title color, subtitle color, body text color, muted text color",
  },
];

const pageLocalRows = [
  "page composition and grouping",
  "section order",
  "workflow-specific filters",
  "field visibility by module",
  "table columns and ordering",
  "module-specific action placement",
];

function PreviewHint({
  controls,
  children,
  className = "",
  onHoverChange,
}: {
  controls: string;
  children: ReactNode;
  className?: string;
  onHoverChange: (value: string | null) => void;
}) {
  return (
    <div
      className={`relative ${className}`}
      onMouseEnter={() => onHoverChange(controls)}
      onMouseLeave={() => onHoverChange(null)}
      onFocus={() => onHoverChange(controls)}
      onBlur={() => onHoverChange(null)}
    >
      {children}
    </div>
  );
}

export function UiPreviewClient() {
  const [checked, setChecked] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [hoveredControls, setHoveredControls] = useState<string | null>(null);

  return (
    <div className="space-y-8">
      <PageHeader
        title="UI Preview"
        description="Visual preview of the shared UI system before page-by-page migration starts."
      />

      <AppearancePreviewPanel scopeLabel="Appearance editor for the live app" />

      <SectionCard
        title="What This Page Is"
        description="This is the single place where shared appearance tokens are edited and previewed."
      >
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>
            Use this page to judge the look of buttons, labels, fields, cards,
            badges, tables, and support text.
          </p>
          <p>
            Changes made here affect the whole app in this browser so you can
            spot pages that still resist the shared visual system.
          </p>
        </div>
      </SectionCard>

      <Alert>
        <div>
          <div className="mb-1 font-medium">Hover Guidance</div>
          <p className="text-sm">
            {hoveredControls
              ? `Change in panel: ${hoveredControls}`
              : "Hover a preview element to see exactly which controls affect it."}
          </p>
        </div>
      </Alert>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Primary Radius" value="Token-driven" />
        <StatCard title="Field System" value="Shared" />
        <StatCard title="Global Controls" value="Visual only" />
      </div>

      <SectionCard
        title="Shell Preview"
        description="Mini preview of the sidebar and top bar so shell styling is visible here too."
      >
        <PreviewHint
          controls="Sidebar Background, Sidebar Base Text, Sidebar Section Label, Sidebar Link Text, Sidebar Link Hover Background, Topbar Background, Topbar Text"
          className="block"
          onHoverChange={setHoveredControls}
        >
        <div className="overflow-hidden rounded-xl border">
          <div className="grid min-h-[320px] md:grid-cols-[220px_1fr]">
            <aside className="sidebar !relative !top-auto !h-auto">
              <div className="brand">
                <div className="brand-mark" />
                <strong>STREHË Admin</strong>
              </div>

              <nav className="shell-nav">
                <div className="shell-nav-group">
                  <p className="shell-nav-label">Operations</p>
                  <a href="#preview">Clients</a>
                  <a href="#preview">Properties</a>
                  <a href="#preview">Contracts</a>
                </div>
                <div className="shell-nav-group">
                  <p className="shell-nav-label">Configuration</p>
                  <a href="#preview">Services</a>
                  <a href="#preview">Packages</a>
                  <a href="#preview">Settings</a>
                </div>
              </nav>
            </aside>

            <div className="main">
              <div className="topbar">
                <div className="row">
                  <h1 className="topbar-title">STREHË Admin</h1>
                </div>
              </div>
              <div className="content space-y-4">
                <p className="text-sm text-muted-foreground">
                  This block mirrors the app shell so sidebar and header styling
                  can be judged directly on the preview page.
                </p>
                <div className="grid gap-4 md:grid-cols-2">
                  <Card size="sm">
                    <CardHeader>
                      <CardTitle>Shell Card</CardTitle>
                      <CardDescription>Preview content inside the app chrome.</CardDescription>
                    </CardHeader>
                  </Card>
                  <Card size="sm">
                    <CardHeader>
                      <CardTitle>Secondary Surface</CardTitle>
                      <CardDescription>Use this to spot shell contrast issues quickly.</CardDescription>
                    </CardHeader>
                  </Card>
                </div>
              </div>
            </div>
          </div>
        </div>
        </PreviewHint>
      </SectionCard>

      <SectionCard
        title="Buttons"
        description="One small set of reusable button treatments."
      >
        <div className="flex flex-wrap gap-3">
          <PreviewHint controls="Primary Button Background, Primary Button Text, Shared Radius" onHoverChange={setHoveredControls}>
            <Button>Primary Button</Button>
          </PreviewHint>
          <PreviewHint controls="Secondary Button Background, Secondary Button Text, Shared Radius" onHoverChange={setHoveredControls}>
            <Button variant="secondary">Secondary Button</Button>
          </PreviewHint>
          <PreviewHint controls="Outline Button Background, Outline Button Text, Outline Button Border" onHoverChange={setHoveredControls}>
            <Button variant="outline">Outline Button</Button>
          </PreviewHint>
          <PreviewHint controls="Ghost Button Text, Ghost Button Hover Background, Ghost Button Hover Text" onHoverChange={setHoveredControls}>
            <Button variant="ghost">Ghost Button</Button>
          </PreviewHint>
          <PreviewHint controls="Destructive Button Background, Destructive Button Text, Shared Radius" onHoverChange={setHoveredControls}>
            <Button variant="destructive">Destructive Button</Button>
          </PreviewHint>
          <PreviewHint controls="Primary Button Background, Primary Button Text" onHoverChange={setHoveredControls}>
            <Button disabled>Disabled Button</Button>
          </PreviewHint>
        </div>
      </SectionCard>

      <SectionCard
        title="Fields"
        description="Shared field look only. Layout stays page-local."
      >
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <PreviewHint
              controls="Input Background, Input Text, Input Border, Input Placeholder, Input Focus Ring"
              className="block"
              onHoverChange={setHoveredControls}
            >
              <FormInput
                label="Form Input"
                name="preview-name"
                defaultValue="Example value"
                hint="This is helper text."
              />
            </PreviewHint>

            <PreviewHint
              controls="Input Background, Input Border, Destructive Button Background"
              className="block"
              onHoverChange={setHoveredControls}
            >
              <FormInput
                label="Form Input With Error"
                name="preview-error"
                defaultValue="Problem value"
                error="This is what an inline error should look like."
              />
            </PreviewHint>

            <PreviewHint
              controls="Input Background, Input Text, Input Border, Input Focus Ring"
              className="block"
              onHoverChange={setHoveredControls}
            >
              <div className="space-y-2">
                <Label htmlFor="plain-input">Input Primitive</Label>
                <Input id="plain-input" placeholder="Plain input using shared primitive" />
              </div>
            </PreviewHint>

            <PreviewHint
              controls="Textarea Background, Textarea Text, Textarea Border, Textarea Placeholder, Textarea Focus Ring"
              className="block"
              onHoverChange={setHoveredControls}
            >
              <div className="space-y-2">
                <Label htmlFor="plain-textarea">Textarea Primitive</Label>
                <Textarea
                  id="plain-textarea"
                  placeholder="Textarea preview"
                  defaultValue="This shows the shared textarea look."
                />
              </div>
            </PreviewHint>
          </div>

          <div className="space-y-4">
            <PreviewHint
              controls="Select Background, Select Text, Select Border, Select Placeholder, Select Focus Ring"
              className="block"
              onHoverChange={setHoveredControls}
            >
              <div className="space-y-2">
                <Label>Select Primitive</Label>
                <Select defaultValue="office">
                  <SelectTrigger>
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">admin</SelectItem>
                    <SelectItem value="office">office</SelectItem>
                    <SelectItem value="field">field</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </PreviewHint>

            <PreviewHint
              controls="Checkbox Background, Checkbox Border, Checkbox Focus Ring, Checkbox Checked Background, Checkbox Checked Border, Checkbox Checkmark"
              className="block"
              onHoverChange={setHoveredControls}
            >
              <div className="space-y-2">
                <Label className="text-sm text-foreground">Checkbox Primitive</Label>
                <label className="flex items-center gap-3 text-sm text-foreground">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(value) => setChecked(value === true)}
                  />
                  Example checkbox label
                </label>
              </div>
            </PreviewHint>

            <PreviewHint
              controls="Input Background, Input Border, Muted Text"
              className="block"
              onHoverChange={setHoveredControls}
            >
              <div className="space-y-2">
                <Label htmlFor="disabled-field">Disabled Field</Label>
                <Input
                  id="disabled-field"
                  disabled
                  value="Disabled state preview"
                  readOnly
                />
              </div>
            </PreviewHint>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Sensitive And Constrained Fields"
        description="Fields that need extra guidance, stronger validation cues, or a controlled visibility toggle."
      >
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label
                htmlFor="preview-password"
                className="text-sm text-foreground"
              >
                Password
              </Label>
              <div className="relative">
                <Input
                  id="preview-password"
                  type={showPassword ? "text" : "password"}
                  defaultValue="TestPassword123!"
                  aria-describedby="preview-password-hint"
                  className="pr-11"
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              <p
                id="preview-password-hint"
                className="text-xs text-muted-foreground"
              >
                Example guidance: minimum length, uppercase, lowercase, number,
                and special character.
              </p>
            </div>

            <FormInput
              label="Password With Validation Error"
              name="preview-password-error"
              type="password"
              defaultValue="12345"
              error="Password must be at least 8 characters and include upper, lower, and a number."
            />
          </div>

          <div className="space-y-4">
            <PreviewHint
              controls="Input Background, Input Text, Input Border, Input Placeholder"
              className="block"
              onHoverChange={setHoveredControls}
            >
              <FormInput
                label="IBAN"
                name="preview-iban"
                placeholder="e.g. XK051212012345678906"
                hint="Must follow IBAN format: country code, check digits, and account sequence."
              />
            </PreviewHint>

            <PreviewHint
              controls="Input Background, Input Border, Destructive Button Background"
              className="block"
              onHoverChange={setHoveredControls}
            >
              <FormInput
                label="IBAN With Validation Error"
                name="preview-iban-error"
                defaultValue="12345"
                error="IBAN format is invalid. Example: XK051212012345678906"
              />
            </PreviewHint>

            <PreviewHint
              controls="Empty State Background, Empty State Border, Empty State Icon Background, Empty State Icon Color, Primary Text, Muted Text"
              className="block"
              onHoverChange={setHoveredControls}
            >
              <Alert>
                <div>
                  <div className="mb-1 font-medium">Validation Guidance</div>
                  <p className="text-sm">
                    Sensitive or constrained fields should always make it hard to
                    misunderstand what is required.
                  </p>
                </div>
              </Alert>
            </PreviewHint>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Badges And Alerts"
        description="Reusable status and feedback treatments."
      >
        <div className="space-y-5">
          <div className="flex flex-wrap gap-2">
            <PreviewHint controls="Muted Text, Border Color" onHoverChange={setHoveredControls}>
              <Badge variant="neutral">neutral</Badge>
            </PreviewHint>
            <PreviewHint controls="Info Badge Fill, Info Badge Text" onHoverChange={setHoveredControls}>
              <Badge variant="info">info</Badge>
            </PreviewHint>
            <PreviewHint controls="Success Badge Fill, Success Badge Text" onHoverChange={setHoveredControls}>
              <Badge variant="success">success</Badge>
            </PreviewHint>
            <PreviewHint controls="Warning Badge Fill, Warning Badge Text" onHoverChange={setHoveredControls}>
              <Badge variant="warning">warning</Badge>
            </PreviewHint>
            <PreviewHint controls="Danger Badge Fill, Danger Badge Text" onHoverChange={setHoveredControls}>
              <Badge variant="danger">danger</Badge>
            </PreviewHint>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <PreviewHint
              controls="Default Alert Background, Default Alert Border, Default Alert Text, Default Alert Icon"
              className="block"
              onHoverChange={setHoveredControls}
            >
              <Alert>
                <CircleAlert className="h-4 w-4" />
                <div>
                  <div className="mb-1 font-medium">Default Alert</div>
                  <p className="text-sm">
                    Shared informational or confirmation message.
                  </p>
                </div>
              </Alert>
            </PreviewHint>

            <PreviewHint
              controls="Destructive Alert Background, Destructive Alert Border, Destructive Alert Text, Destructive Alert Icon"
              className="block"
              onHoverChange={setHoveredControls}
            >
              <Alert variant="destructive">
                <CircleAlert className="h-4 w-4" />
                <div>
                  <div className="mb-1 font-medium">Destructive Alert</div>
                  <p className="text-sm">
                    Shared destructive or error-state message.
                  </p>
                </div>
              </Alert>
            </PreviewHint>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <PreviewHint
              controls="Info Alert Background, Info Alert Border, Info Alert Text, Info Alert Icon"
              className="block"
              onHoverChange={setHoveredControls}
            >
              <Alert variant="info">
                <Info className="h-4 w-4" />
                <div>
                  <div className="mb-1 font-medium">Info Alert</div>
                  <p className="text-sm">Shared guidance or helper-state surface.</p>
                </div>
              </Alert>
            </PreviewHint>

            <PreviewHint
              controls="Success Alert Background, Success Alert Border, Success Alert Text, Success Alert Icon"
              className="block"
              onHoverChange={setHoveredControls}
            >
              <Alert variant="success">
                <ShieldCheck className="h-4 w-4" />
                <div>
                  <div className="mb-1 font-medium">Success Alert</div>
                  <p className="text-sm">Positive confirmation or healthy-state surface.</p>
                </div>
              </Alert>
            </PreviewHint>

            <PreviewHint
              controls="Warning Alert Background, Warning Alert Border, Warning Alert Text, Warning Alert Icon"
              className="block"
              onHoverChange={setHoveredControls}
            >
              <Alert variant="warning">
                <TriangleAlert className="h-4 w-4" />
                <div>
                  <div className="mb-1 font-medium">Warning Alert</div>
                  <p className="text-sm">Cautionary state that is stronger than helper copy.</p>
                </div>
              </Alert>
            </PreviewHint>
          </div>
        </div>
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <SectionCard
          title="Cards And Detail Fields"
        description="How entity details should feel when built from shared surfaces."
      >
        <div className="grid gap-4 lg:grid-cols-2">
            <PreviewHint
              controls="Card Background, Border Color, Primary Text, Muted Text, Shared Radius"
              className="block"
              onHoverChange={setHoveredControls}
            >
            <Card>
              <CardHeader>
                <CardTitle>Standard Card</CardTitle>
                <CardDescription>
                  This is the base card treatment for the app.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <DetailField label="Label" value="Value" />
                <DetailField label="Status" value={<Badge variant="success">Active</Badge>} />
                <DetailField label="Secondary value" value="Muted but readable" />
                <DetailField label="Empty" value="-" />
              </CardContent>
            </Card>
            </PreviewHint>

            <PreviewHint
              controls="Card Background, Border Color, Primary Text, Muted Text"
              className="block"
              onHoverChange={setHoveredControls}
            >
              <EmptyState
                title="Empty State"
                description="No records here yet. This is how no-data screens should feel when standardized."
                action={<Button variant="outline">Add First Item</Button>}
              />
            </PreviewHint>
          </div>
        </SectionCard>

        <SectionCard
          title="Typography Preview"
          description="These are the text roles we should be tuning globally, not page by page."
        >
          <div className="space-y-4">
            <div>
              <p className="text-2xl font-semibold text-foreground">Page title style</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Supporting subtitle / descriptive copy
              </p>
            </div>

            <div>
              <p className="text-base font-medium text-foreground">Section title style</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Muted text / helper content / meta copy
              </p>
            </div>

            <div>
              <p className="text-sm text-foreground">
                Body text preview for normal readable content inside cards and pages.
              </p>
            </div>
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Tables"
        description="Visual table treatment only. Columns, ordering, and meaning stay module-local."
      >
        <div className="space-y-6">
          <PreviewHint
            controls="Card Background, Border Color, Primary Text, Field Background"
            className="block"
            onHoverChange={setHoveredControls}
          >
          <ListToolbar actions={<Button variant="outline">Toolbar Action</Button>}>
            <FormInput
              label="Search"
              name="toolbar-search"
              placeholder="Search records"
            />
            <div className="min-w-[180px] space-y-2">
              <Label>Filter</Label>
              <Select defaultValue="all">
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </ListToolbar>
          </PreviewHint>

          <PreviewHint
            controls="Card Background, Border Color, Table Header, Table Header Text, Table Body Text, Table Row Border, Success Badge Fill"
            className="block"
            onHoverChange={setHoveredControls}
          >
          <TableShell>
            <Table>
              <TableHeader>
                <tr>
                  <TableHead>Compact Table</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </tr>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">Expense Category</TableCell>
                  <TableCell>
                    <StatusBadge status="active" />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="outline" size="sm">
                        Edit
                      </Button>
                      <Button variant="ghost" size="sm">
                        Disable
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableShell>
          </PreviewHint>

          <PreviewHint
            controls="Card Background, Border Color, Table Header, Table Header Text, Table Body Text, Table Row Border, Warning/Info badge colors"
            className="block"
            onHoverChange={setHoveredControls}
          >
          <TableShell>
            <Table>
              <TableHeader>
                <tr>
                  <TableHead>Operational Table</TableHead>
                  <TableHead>Property</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </tr>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>
                    <div className="font-medium">Client Name</div>
                    <div className="text-muted-foreground">Secondary row text</div>
                  </TableCell>
                  <TableCell>Property A-201</TableCell>
                  <TableCell>
                    <StatusBadge status="pending" />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="sm">
                        View
                      </Button>
                      <Button variant="outline" size="sm">
                        Edit
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableShell>
          </PreviewHint>
        </div>
      </SectionCard>

      <SectionCard
        title="Global Controls"
        description="These are the visual properties the future appearance panel should be able to change across the whole app."
      >
        <div className="overflow-hidden rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-[var(--table-header-bg)] text-[var(--table-header-text)]">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Element</th>
                <th className="px-4 py-3 text-left font-medium">Globally Changeable</th>
              </tr>
            </thead>
            <tbody>
              {globalControlRows.map((row) => (
                <tr
                  key={row.element}
                  className="border-t border-[var(--table-row-border)] align-top text-[var(--table-body-text)]"
                >
                  <td className="px-4 py-3 font-medium">{row.element}</td>
                  <td className="px-4 py-3 text-muted-foreground">{row.controls}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard
        title="What Stays Local"
        description="These things should not be globalized in the appearance system."
      >
        <ul className="grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
          {pageLocalRows.map((item) => (
            <li key={item} className="rounded-lg border bg-muted/20 px-3 py-2">
              {item}
            </li>
          ))}
        </ul>
      </SectionCard>
    </div>
  );
}
