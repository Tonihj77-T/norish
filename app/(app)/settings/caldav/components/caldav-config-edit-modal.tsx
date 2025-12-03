"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  Chip,
  Accordion,
  AccordionItem,
} from "@heroui/react";
import { ServerIcon } from "@heroicons/react/24/outline";

import { useCalDavSettingsContext } from "../context";

import SecretInput from "@/components/shared/secret-input";

interface CalDavConfigEditModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CalDavConfigEditModal({ isOpen, onClose }: CalDavConfigEditModalProps) {
  const { config, saveConfig, testConnection, getCaldavPassword } = useCalDavSettingsContext();

  const [serverUrl, setServerUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [breakfastTime, setBreakfastTime] = useState("07:00-08:00");
  const [lunchTime, setLunchTime] = useState("12:00-13:00");
  const [dinnerTime, setDinnerTime] = useState("18:00-19:00");
  const [snackTime, setSnackTime] = useState("15:00-16:00");

  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const [timeErrors, setTimeErrors] = useState<{
    breakfast?: string;
    lunch?: string;
    dinner?: string;
    snack?: string;
  }>({});

  // Get user's timezone
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Time format regex
  const timeRegex = /^\d{2}:\d{2}-\d{2}:\d{2}$/;

  // Load existing config
  useEffect(() => {
    if (config && isOpen) {
      setServerUrl(config.serverUrl);
      setUsername(config.username);
      setPassword("");
      setEnabled(config.enabled);
      setBreakfastTime(config.breakfastTime);
      setLunchTime(config.lunchTime);
      setDinnerTime(config.dinnerTime);
      setSnackTime(config.snackTime);
      setTestResult(null);
    }
  }, [config, isOpen]);

  const handleRevealPassword = useCallback(async () => {
    return await getCaldavPassword();
  }, [getCaldavPassword]);

  const validateTimeFormat = (time: string, field: string) => {
    if (!timeRegex.test(time)) {
      setTimeErrors((prev) => ({
        ...prev,
        [field]: "Format must be HH:MM-HH:MM",
      }));

      return false;
    }
    setTimeErrors((prev) => {
      const newErrors = { ...prev };

      delete newErrors[field as keyof typeof timeErrors];

      return newErrors;
    });

    return true;
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      // Use form values for test
      const result = await testConnection(
        serverUrl,
        username,
        password || config?.username || "" // Use current password if not changed
      );

      setTestResult(result);
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    // Validate time formats
    const breakfastValid = validateTimeFormat(breakfastTime, "breakfast");
    const lunchValid = validateTimeFormat(lunchTime, "lunch");
    const dinnerValid = validateTimeFormat(dinnerTime, "dinner");
    const snackValid = validateTimeFormat(snackTime, "snack");

    if (!breakfastValid || !lunchValid || !dinnerValid || !snackValid) {
      return;
    }

    setSaving(true);
    setTestResult(null);
    try {
      await saveConfig({
        serverUrl,
        username,
        password, // Empty string if not changed
        enabled,
        breakfastTime,
        lunchTime,
        dinnerTime,
        snackTime,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const canSave = serverUrl && username && (password || config);

  return (
    <Modal isOpen={isOpen} scrollBehavior="inside" size="2xl" onClose={onClose}>
      <ModalContent>
        <ModalHeader className="flex items-center gap-2">
          <ServerIcon className="h-5 w-5" />
          Edit CalDAV Configuration
        </ModalHeader>
        <ModalBody>
          <div className="flex flex-col gap-4">
            <Input
              isRequired
              description="Calendar collection URL ending with /"
              label="Server URL"
              placeholder="https://dav.example.com/calendars/username/calendar/"
              value={serverUrl}
              onValueChange={setServerUrl}
            />

            <Input
              isRequired
              label="Username"
              placeholder="username"
              value={username}
              onValueChange={setUsername}
            />

            {/* Password Section */}
            <SecretInput
              isRequired
              isConfigured={!!config}
              label="Password"
              placeholder="Enter password"
              value={password}
              onReveal={handleRevealPassword}
              onValueChange={setPassword}
            />

            {/* Test Connection Result */}
            {testResult && (
              <Chip color={testResult.success ? "success" : "danger"} size="sm" variant="flat">
                {testResult.message}
              </Chip>
            )}

            {/* Advanced Settings */}
            <Accordion>
              <AccordionItem
                key="advanced"
                aria-label="Advanced Settings"
                title="Advanced Settings"
              >
                <div className="flex flex-col gap-4 pb-4">
                  <p className="text-default-500 text-xs">Timezone: {timezone}</p>

                  <Input
                    description="Format: HH:MM-HH:MM"
                    errorMessage={timeErrors.breakfast}
                    isInvalid={!!timeErrors.breakfast}
                    label="Breakfast Time"
                    placeholder="07:00-08:00"
                    size="sm"
                    value={breakfastTime}
                    onValueChange={(value) => {
                      setBreakfastTime(value);
                      validateTimeFormat(value, "breakfast");
                    }}
                  />

                  <Input
                    description="Format: HH:MM-HH:MM"
                    errorMessage={timeErrors.lunch}
                    isInvalid={!!timeErrors.lunch}
                    label="Lunch Time"
                    placeholder="12:00-13:00"
                    size="sm"
                    value={lunchTime}
                    onValueChange={(value) => {
                      setLunchTime(value);
                      validateTimeFormat(value, "lunch");
                    }}
                  />

                  <Input
                    description="Format: HH:MM-HH:MM"
                    errorMessage={timeErrors.dinner}
                    isInvalid={!!timeErrors.dinner}
                    label="Dinner Time"
                    placeholder="18:00-19:00"
                    size="sm"
                    value={dinnerTime}
                    onValueChange={(value) => {
                      setDinnerTime(value);
                      validateTimeFormat(value, "dinner");
                    }}
                  />

                  <Input
                    description="Format: HH:MM-HH:MM"
                    errorMessage={timeErrors.snack}
                    isInvalid={!!timeErrors.snack}
                    label="Snack Time"
                    placeholder="15:00-16:00"
                    size="sm"
                    value={snackTime}
                    onValueChange={(value) => {
                      setSnackTime(value);
                      validateTimeFormat(value, "snack");
                    }}
                  />
                </div>
              </AccordionItem>
            </Accordion>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button
            isDisabled={!serverUrl || !username || (!password && !config)}
            isLoading={testing}
            variant="bordered"
            onPress={handleTestConnection}
          >
            Test Connection
          </Button>
          <Button
            color="primary"
            isDisabled={!canSave || Object.keys(timeErrors).length > 0}
            isLoading={saving}
            onPress={handleSave}
          >
            Save Changes
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
