"use client";

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button, Input, Label, addToast } from "@basicsos/ui";

// Next.js App Router requires default export — framework exception
const BrandingPage = (): JSX.Element => {
  const { data: branding, isLoading } = trpc.admin.getBranding.useQuery();
  const updateBranding = trpc.admin.updateBranding.useMutation({
    onSuccess: () => addToast({ title: "Branding updated", variant: "success" }),
    onError: (err) =>
      addToast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const [name, setName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [accentColor, setAccentColor] = useState("#6366f1");

  useEffect(() => {
    if (branding) {
      setName(branding.name);
      setLogoUrl(branding.logoUrl ?? "");
      setAccentColor(branding.accentColor);
    }
  }, [branding]);

  const handleSave = (e: React.FormEvent): void => {
    e.preventDefault();
    updateBranding.mutate({
      name: name.trim() || undefined,
      logoUrl: logoUrl.trim() || null,
      accentColor: /^#[0-9a-fA-F]{6}$/.test(accentColor) ? accentColor : undefined,
    });
  };

  if (isLoading) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-stone-900 mb-6">Branding</h1>
        <div className="text-sm text-stone-400">Loading…</div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-stone-900">Branding</h1>
        <p className="mt-1 text-sm text-stone-500">
          Customize your company name, logo, and colors.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Form */}
        <form onSubmit={handleSave} className="space-y-6">
          <div className="rounded-xl border border-stone-200 bg-white p-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="company-name">Company Name</Label>
              <Input
                id="company-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Acme Inc."
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="logo-url">Logo URL</Label>
              <Input
                id="logo-url"
                type="url"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://company.com/logo.png"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="accent-color">Accent Color</Label>
              <div className="flex items-center gap-3">
                <Input
                  id="accent-color"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  placeholder="#6366f1"
                  className="font-mono"
                />
                <input
                  type="color"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="h-9 w-14 cursor-pointer rounded-lg border border-stone-200"
                />
              </div>
              <p className="text-xs text-stone-400">
                Hex format: #rrggbb. Applied to sidebar and primary buttons.
              </p>
            </div>

            <Button type="submit" disabled={updateBranding.isPending}>
              {updateBranding.isPending ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </form>

        {/* Live preview */}
        <div>
          <h2 className="mb-3 text-sm font-semibold text-stone-500 uppercase tracking-wide">
            Preview
          </h2>
          <div className="rounded-xl border border-stone-200 overflow-hidden shadow-sm">
            {/* Mini sidebar preview */}
            <div className="flex h-64 flex-col border-r bg-white" style={{ width: "180px" }}>
              <div
                className="flex items-center gap-2 border-b px-3 py-3"
                style={{ borderBottomColor: `${accentColor}20` }}
              >
                {logoUrl ? (
                  <img src={logoUrl} alt="logo" className="h-7 w-7 rounded-lg object-contain" />
                ) : (
                  <div
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-sm font-bold text-white"
                    style={{ backgroundColor: accentColor }}
                  >
                    {(name || "B")[0]?.toUpperCase()}
                  </div>
                )}
                <div>
                  <div className="text-xs font-semibold text-stone-900">
                    {name || "Company Name"}
                  </div>
                  <div className="text-xs text-stone-400">Company OS</div>
                </div>
              </div>
              {["Dashboard", "Knowledge", "CRM", "Tasks"].map((item) => (
                <div
                  key={item}
                  className="px-3 py-2 text-xs text-stone-600 hover:bg-stone-50 cursor-pointer"
                  style={{ color: item === "Dashboard" ? accentColor : undefined }}
                >
                  {item}
                </div>
              ))}
              <div
                className="mx-3 mt-1 rounded-lg px-2 py-1 text-xs font-medium text-white"
                style={{ backgroundColor: accentColor }}
              >
                + New Item
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BrandingPage;
