"use client";

import { FC, useEffect, useState, MouseEvent, KeyboardEvent } from "react";
import { useTheme } from "next-themes";
import { MoonIcon, SunIcon, ComputerDesktopIcon } from "@heroicons/react/16/solid";
import { Button } from "@heroui/react";

import { cssButtonPill } from "@/config/css-tokens";

export const ThemeSwitch: FC = () => {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Wait until mounted to avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  const effectiveTheme = resolvedTheme ?? theme;
  const isDark = effectiveTheme === "dark";

  const onChange = () => {
    if (theme === "light") setTheme("dark");
    else if (theme === "dark") setTheme("system");
    else setTheme("light");
  };

  const stopProp = (e: MouseEvent | KeyboardEvent) => e.stopPropagation();

  const icon =
    theme === "system" ? (
      <ComputerDesktopIcon className="size-4" />
    ) : isDark ? (
      <MoonIcon className="size-4" />
    ) : (
      <SunIcon className="size-4" />
    );

  const label = theme === "system" ? "System default" : isDark ? "Dark mode" : "Light mode";

  if (!mounted) {
    // Return skeleton or nothing during SSR
    return (
      <div className="w-full">
        <Button
          disabled
          className={`w-full justify-start bg-transparent ${cssButtonPill}`}
          radius="full"
          size="md"
          variant="light"
        >
          <span className="flex flex-col items-start opacity-50">
            <span className="text-sm leading-tight font-medium">Theme</span>
            <span className="text-default-500 text-xs leading-tight">Loading…</span>
          </span>
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full" role="presentation" onClick={stopProp} onKeyDown={stopProp}>
      <Button
        className={`w-full justify-start bg-transparent ${cssButtonPill}`}
        radius="full"
        size="md"
        startContent={<span className="text-default-500">{icon}</span>}
        variant="light"
        onPress={onChange}
      >
        <span className="flex flex-col items-start">
          <span className="text-sm leading-tight font-medium">Theme</span>
          <span className="text-default-500 text-xs leading-tight">{label}</span>
        </span>
      </Button>
    </div>
  );
};
