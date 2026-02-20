import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Save, X, Users, Check } from "lucide-react";

const COLOR_PALETTE = [
  "#06b6d4", // cyan
  "#8b5cf6", // violet
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ef4444", // red
  "#6366f1", // indigo
];

export default function ClientModal({ isOpen, onClose, onSave, client = null }) {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    hourly_rate: "",
    abbreviation: "",
    color: "",
  });

  useEffect(() => {
    if (client) {
      setFormData({
        name: client.name || "",
        email: client.email || "",
        phone: client.phone || "",
        address: client.address || "",
        hourly_rate: client.hourly_rate ?? "",
        abbreviation: client.abbreviation || "",
        color: client.color || "",
      });
    } else {
      setFormData({
        name: "",
        email: "",
        phone: "",
        address: "",
        hourly_rate: "",
        abbreviation: "",
        color: "",
      });
    }
  }, [client, isOpen]);

  const handleSave = () => {
    if (!formData.name.trim()) {
      alert("Please enter a client name");
      return;
    }

    const dataToSave = {
      ...formData,
      hourly_rate: formData.hourly_rate !== "" ? parseFloat(formData.hourly_rate) : null,
      abbreviation: formData.abbreviation.trim(),
      color: formData.color,
    };

    onSave(dataToSave, client?.id);
    
    // Reset form
    setFormData({
      name: "",
      email: "",
      phone: "",
      address: "",
      hourly_rate: "",
      abbreviation: "",
      color: "",
    });
  };

  const handleCancel = () => {
    setFormData({
      name: "",
      email: "",
      phone: "",
      address: "",
      hourly_rate: "",
      abbreviation: "",
      color: "",
    });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-gray-900 border-gray-800">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Users className="w-5 h-5 text-cyan-400" />
            {client ? "Edit Client" : "Add New Client"}
          </DialogTitle>
        </DialogHeader>
        
        <div className="py-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="clientName" className="text-gray-300">Client Name *</Label>
            <Input
              id="clientName"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Company or Individual"
              className="bg-gray-800/50 border-gray-700 text-gray-200 placeholder:text-gray-500"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="clientEmail" className="text-gray-300">Email</Label>
            <Input
              id="clientEmail"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="client@example.com"
              className="bg-gray-800/50 border-gray-700 text-gray-200 placeholder:text-gray-500"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="clientPhone" className="text-gray-300">Phone</Label>
            <Input
              id="clientPhone"
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="+1 (555) 123-4567"
              className="bg-gray-800/50 border-gray-700 text-gray-200 placeholder:text-gray-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="clientHourlyRate" className="text-gray-300">Hourly Rate ($/hr)</Label>
              <Input
                id="clientHourlyRate"
                type="number"
                value={formData.hourly_rate}
                onChange={(e) => setFormData({ ...formData, hourly_rate: e.target.value })}
                placeholder="Default rate"
                className="bg-gray-800/50 border-gray-700 text-gray-200 placeholder:text-gray-500"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="clientAbbreviation" className="text-gray-300">Client Abbreviation</Label>
              <Input
                id="clientAbbreviation"
                value={formData.abbreviation}
                onChange={(e) => setFormData({ ...formData, abbreviation: e.target.value })}
                placeholder="e.g. ATC"
                className="bg-gray-800/50 border-gray-700 text-gray-200 placeholder:text-gray-500 uppercase"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="clientAddress" className="text-gray-300">Address</Label>
            <Textarea
              id="clientAddress"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="123 Main St, City, State 12345"
              rows={2}
              className="bg-gray-800/50 border-gray-700 text-gray-200 placeholder:text-gray-500"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-gray-300">Color</Label>
            <div className="flex gap-2">
              {COLOR_PALETTE.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setFormData({ ...formData, color })}
                  className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${
                    formData.color === color
                      ? "border-white scale-110"
                      : "border-transparent hover:scale-105"
                  }`}
                  style={{ backgroundColor: color }}
                >
                  {formData.color === color && (
                    <Check className="w-4 h-4 text-white drop-shadow-md" />
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              onClick={handleSave}
              className="flex-1 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-bold rounded-xl"
            >
              <Save className="w-4 h-4 mr-2" />
              {client ? "Update Client" : "Save Client"}
            </Button>
            <Button
              onClick={handleCancel}
              variant="outline"
              className="flex-1 border-gray-700 text-gray-300 hover:bg-gray-800 rounded-xl"
            >
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}