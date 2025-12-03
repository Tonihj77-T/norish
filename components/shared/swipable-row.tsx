"use client";
// FULLY AI GENERATED - DO NOT EDIT - I HAVE NO IDEA HOW THIS WORKS :D
import {
  animate,
  clamp,
  motion,
  MotionValue,
  useMotionValue,
  useMotionValueEvent,
  useSpring,
  useTransform,
} from "motion/react";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";

import { createClientLogger } from "@/lib/logger";

const log = createClientLogger("SwipeableRow");

const SPRING_OPTIONS = { stiffness: 900, damping: 80 };

// Button design constants
const MAX_BUTTON_SIZE = 56; // Maximum button size
const MIN_BUTTON_SIZE = 40; // Minimum button size
const BUTTON_GAP = 6; // 6px gap between buttons
const CONTAINER_PADDING = 8; // Padding on sides
const ROW_PADDING = 4; // Padding from top/bottom of row

const FULL_SWIPE_THRESHOLD = 0.9; // 90% to snap full
const SNAP_THRESHOLD = 0.02; // 2%swipe to snap open

// Calculate button size based on row height
function calculateButtonSize(rowHeight?: number): number {
  if (!rowHeight) return MAX_BUTTON_SIZE;
  const availableHeight = rowHeight - ROW_PADDING * 2;

  return Math.min(Math.max(availableHeight, MIN_BUTTON_SIZE), MAX_BUTTON_SIZE);
}

// Calculate total width needed for action buttons
function calculateActionsWidth(actionCount: number, buttonSize: number): number {
  // Add small buffer to ensure buttons are fully visible
  const buffer = 4;

  return actionCount * buttonSize + (actionCount - 1) * BUTTON_GAP + CONTAINER_PADDING * 2 + buffer;
}

// Color mapping for semantic colors to theme
const COLOR_MAP = {
  danger: {
    bg: "bg-danger",
    hoverBg: "hover:bg-danger-600",
    text: "text-danger-foreground",
  },
  blue: {
    bg: "bg-info-500",
    hoverBg: "hover:bg-info-600",
    text: "text-info-foreground",
  },
  yellow: {
    bg: "bg-accent-500",
    hoverBg: "hover:bg-accent-600",
    text: "text-accent-foreground",
  },
};

function getActionColors(action: SwipeAction) {
  return COLOR_MAP[action.color] || COLOR_MAP.blue;
}

export type SwipeAction = {
  key: string;
  icon: React.ElementType;
  color: "blue" | "yellow" | "danger";
  onPress: () => void;
  primary?: boolean;
  label?: string;
};

export type SwipeableRowRef = {
  openRow: () => void;
  closeRow: () => void;
  isOpen: () => boolean;
};

type Props = {
  children: React.ReactNode;
  actions: SwipeAction[];
  rowHeight?: number;
  disableSwipeOnDesktop?: boolean;
  onOpenChange?: (open: boolean) => void;
};

const SwipeableRow = forwardRef<SwipeableRowRef, Props>(
  ({ children, actions, rowHeight, disableSwipeOnDesktop = true, onOpenChange }, ref) => {
    // Validate actions length
    if (actions.length < 1 || actions.length > 3) {
      log.error("actions must contain 1-3 items, got %d", String(actions.length));
    }

    const [isOpen, setIsOpen] = useState(false);
    const [committing, setCommitting] = useState<SwipeAction | null>(null);
    const [focusedActionIndex, setFocusedActionIndex] = useState<number>(-1);

    const swipeContainerRef = useRef<HTMLDivElement>(null);
    const swipeItemRef = useRef<HTMLDivElement>(null);

    const swipeItemWidth = useRef(0);
    const actionsWidthPx = useRef(0);
    const buttonSize = useRef(calculateButtonSize(rowHeight));
    const swipeStartX = useRef(0);
    const swipeStartY = useRef(0);
    const swipeStartOffset = useRef(0);
    const fullSwipeSnapPosition = useRef<"left" | null>(null);

    const isDraggingRef = useRef(false);
    const directionRef = useRef<"h" | "v" | null>(null);

    // Row translate
    const swipeAmount = useMotionValue(0);
    const swipeAmountSpring = useSpring(swipeAmount, SPRING_OPTIONS);
    const swipeProgress = useTransform(swipeAmount, (value) => {
      // Calculate progress relative to actions width, not row width
      // This ensures buttons appear correctly whether swiped manually or opened programmatically
      const actionsW = actionsWidthPx.current;

      return actionsW ? value / actionsW : 0;
    });

    // Commit overlay width (anchored to right:0)
    const overlayWidth = useMotionValue(0);

    // Imperative API
    useImperativeHandle(
      ref,
      () => ({
        openRow: () => {
          // Recalculate in case it wasn't ready
          buttonSize.current = calculateButtonSize(rowHeight);
          actionsWidthPx.current = calculateActionsWidth(actions.length, buttonSize.current);
          // Faster duration for fewer actions (shorter distance)
          // 1 action: 0.15s, 2 actions: 0.175s, 3 actions: 0.2s
          const duration = 0.125 + actions.length * 0.025;

          return animate(swipeAmount, -actionsWidthPx.current, {
            duration,
            ease: "easeOut",
          });
        },
        closeRow: () => {
          const duration = 0.125 + actions.length * 0.025;

          return animate(swipeAmount, 0, { duration, ease: "easeOut" });
        },
        isOpen: () => isOpen,
      }),
      [isOpen, actions.length, rowHeight, swipeAmount]
    );

    // Open flag + callback
    useMotionValueEvent(swipeAmount, "change", (val) => {
      const next = Math.abs(val) > 5;

      if (next !== isOpen) {
        setIsOpen(next);
        onOpenChange?.(next);
      }
    });

    // Measure width
    useEffect(() => {
      const measure = () => {
        const w = swipeItemRef.current?.getBoundingClientRect().width;

        if (w) {
          swipeItemWidth.current = w;
          buttonSize.current = calculateButtonSize(rowHeight);
          actionsWidthPx.current = calculateActionsWidth(actions.length, buttonSize.current);
        }
      };

      measure();
      window.addEventListener("resize", measure);

      return () => window.removeEventListener("resize", measure);
    }, [actions.length, rowHeight]);

    // Close on outside click / any scroll
    useEffect(() => {
      if (!isOpen || committing) return;
      const close = () => animate(swipeAmount, 0, { duration: 0.2 });

      const onPointerDown = (e: PointerEvent) => {
        const el = swipeContainerRef.current;

        if (!el) return;
        if (!el.contains(e.target as Node)) close();
      };
      const onScroll = () => close();

      document.addEventListener("pointerdown", onPointerDown, { capture: true });
      window.addEventListener("scroll", onScroll, { passive: true, capture: true });
      document.addEventListener("scroll", onScroll, { passive: true, capture: true });

      return () => {
        document.removeEventListener("pointerdown", onPointerDown, { capture: true } as any);
        window.removeEventListener("scroll", onScroll, { capture: true } as any);
        document.removeEventListener("scroll", onScroll, { capture: true } as any);
      };
    }, [isOpen, committing, swipeAmount]);

    // Commit: right-anchored overlay expands, content fades, container fades, then callback
    const commitDelete = useCallback(
      async (action: SwipeAction) => {
        const w = swipeItemWidth.current;

        if (!w || !swipeContainerRef.current) return;

        // Start overlay at one button width
        const startW = buttonSize.current + CONTAINER_PADDING;

        setCommitting(action);
        overlayWidth.set(startW);
        await new Promise<void>((r) => requestAnimationFrame(() => r()));

        const expand = animate(overlayWidth, w, { duration: 0.22, ease: "easeOut" });
        const fadeContent = swipeItemRef.current
          ? animate(swipeItemRef.current, { opacity: 0 }, { duration: 0.18, ease: "easeOut" })
          : Promise.resolve();

        await Promise.all([expand, fadeContent]);

        await animate(
          swipeContainerRef.current,
          { opacity: 0 },
          { duration: 0.24, ease: "easeOut" }
        );
        action.onPress();

        // Reset
        swipeAmount.jump(0);
        swipeAmountSpring.jump(0);
        if (swipeItemRef.current) swipeItemRef.current.style.opacity = "1";
        if (swipeContainerRef.current) swipeContainerRef.current.style.opacity = "1";
        overlayWidth.set(0);
        setCommitting(null);
      },
      [overlayWidth, swipeAmount, swipeAmountSpring]
    );

    const closeRow = () => animate(swipeAmount, 0, { duration: 0.3, ease: "easeOut" });

    // Keyboard navigation
    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (disableSwipeOnDesktop) return; // Only on desktop

      // Open/close with Space or Enter
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (isOpen) {
          closeRow();
          setFocusedActionIndex(-1);
        } else {
          // Recalculate before opening
          buttonSize.current = calculateButtonSize(rowHeight);
          actionsWidthPx.current = calculateActionsWidth(actions.length, buttonSize.current);
          animate(swipeAmount, -actionsWidthPx.current, { duration: 0.3, ease: "easeOut" });
          setFocusedActionIndex(0); // Focus first action
        }

        return;
      }

      // Navigate actions with arrow keys when open
      if (isOpen) {
        if (e.key === "ArrowRight" && focusedActionIndex < actions.length - 1) {
          e.preventDefault();
          setFocusedActionIndex(focusedActionIndex + 1);
        } else if (e.key === "ArrowLeft" && focusedActionIndex > 0) {
          e.preventDefault();
          setFocusedActionIndex(focusedActionIndex - 1);
        } else if (e.key === "Escape") {
          e.preventDefault();
          closeRow();
          setFocusedActionIndex(-1);
        } else if (e.key === "Enter" && focusedActionIndex >= 0) {
          e.preventDefault();
          const action = actions[focusedActionIndex];

          if (action.primary) {
            commitDelete(action);
          } else {
            action.onPress();
            closeRow();
          }
        }
      }
    };

    // Swipe gesture
    useEffect(() => {
      const handlePointerMove = (e: PointerEvent) => {
        if (!isDraggingRef.current || committing) return;

        const dx = e.clientX - swipeStartX.current;
        const dy = Math.abs(e.clientY - swipeStartY.current);

        if (!directionRef.current) {
          if (Math.abs(dx) > 10 && Math.abs(dx) > dy) {
            directionRef.current = "h";
            swipeContainerRef.current?.setPointerCapture?.((e as any).pointerId);
          } else if (dy > 10 && dy > Math.abs(dx)) {
            directionRef.current = "v";
            isDraggingRef.current = false;

            return;
          }
        }
        if (directionRef.current !== "h") return;

        const w = swipeItemWidth.current;

        if (!w) return;

        const delta = e.clientX - swipeStartX.current + swipeStartOffset.current;
        const fullSwipeThreshold = w * FULL_SWIPE_THRESHOLD;
        const beyond = Math.abs(delta) > fullSwipeThreshold;

        if (fullSwipeSnapPosition.current) {
          const back = Math.abs(delta) < fullSwipeThreshold;

          if (back) {
            fullSwipeSnapPosition.current = null;
            swipeAmount.set(delta);
          } else {
            swipeAmount.set(-w);
          }

          return;
        }

        // Only allow full commit when not already open
        if (beyond && !isOpen) {
          fullSwipeSnapPosition.current = "left";
          swipeAmount.set(-w);
        } else {
          swipeAmount.set(clamp(-w, 0, delta));
        }
      };

      const handlePointerUp = () => {
        if (!isDraggingRef.current && directionRef.current !== "h") {
          directionRef.current = null;

          return;
        }
        const wasHorizontal = directionRef.current === "h";

        isDraggingRef.current = false;
        if (!wasHorizontal || committing) {
          directionRef.current = null;

          return;
        }

        const w = swipeItemWidth.current;

        if (!w) {
          directionRef.current = null;

          return;
        }

        const current = swipeAmount.get();
        let target = 0;
        const snapPx = w * SNAP_THRESHOLD;
        const targetOpen = -actionsWidthPx.current;

        if (Math.abs(current) > snapPx) {
          target = targetOpen;
        }

        if (fullSwipeSnapPosition.current === "left" && !isOpen) {
          const primary = actions.find((a) => a.primary);

          if (primary) commitDelete(primary);
        } else {
          // Dynamic duration based on action count for proportional feel
          // 1 action: 0.15s, 2 actions: 0.175s, 3 actions: 0.2s
          const duration = 0.125 + actions.length * 0.025;

          animate(swipeAmount, target, { duration, ease: "easeOut" });
        }

        fullSwipeSnapPosition.current = null;
        directionRef.current = null;
      };

      document.addEventListener("pointermove", handlePointerMove, { passive: true });
      document.addEventListener("pointerup", handlePointerUp, { passive: true });

      return () => {
        document.removeEventListener("pointermove", handlePointerMove);
        document.removeEventListener("pointerup", handlePointerUp);
      };
    }, [actions, swipeAmount, isOpen, committing, swipeAmountSpring, commitDelete]);

    const shouldStartSwipe = (e: React.PointerEvent) => {
      if (!disableSwipeOnDesktop) return true;

      return e.pointerType === "touch" || e.pointerType === "pen";
    };

    const PrimaryIcon = committing?.icon;
    const committingColors = committing ? getActionColors(committing) : null;

    return (
      <div
        className="cursor-default"
        role="row"
        tabIndex={disableSwipeOnDesktop ? -1 : 0}
        onKeyDown={handleKeyDown}
      >
        <motion.div
          ref={swipeContainerRef}
          className="relative w-full overflow-hidden rounded-md"
          style={{
            height: rowHeight ? rowHeight : "auto",
            touchAction: "pan-y",
          }}
          onPointerDown={(e) => {
            if (!shouldStartSwipe(e) || committing) return;
            isDraggingRef.current = true;
            directionRef.current = null;
            swipeStartX.current = e.clientX;
            swipeStartY.current = e.clientY;
            swipeStartOffset.current = swipeAmount.get();
          }}
        >
          {/* Commit overlay (right-anchored), icon centered */}
          {committing && committingColors && (
            <motion.div
              className={`absolute right-0 z-30 ${committingColors.bg} pointer-events-none flex items-center justify-center rounded-full`}
              style={{
                width: overlayWidth,
                height: buttonSize.current,
                top: "50%",
                transform: "translateY(-50%)",
              }}
            >
              {PrimaryIcon ? <PrimaryIcon className="h-5 w-5 text-white opacity-90" /> : null}
            </motion.div>
          )}

          {/* Actions behind: dynamic width */}
          <ActionsGroup
            actions={actions}
            actionsWidth={actionsWidthPx.current}
            buttonSize={buttonSize.current}
            closeRow={closeRow}
            commitDelete={commitDelete}
            focusedIndex={focusedActionIndex}
            isOpen={isOpen}
            swipeAmount={swipeAmountSpring}
            swipeProgress={swipeProgress}
          />

          {/* Foreground row content */}
          <motion.div
            ref={swipeItemRef}
            className="relative z-20 h-full w-full"
            style={{ x: swipeAmountSpring }}
            onClick={() => {
              if (isOpen) closeRow();
            }}
          >
            {children}
          </motion.div>
        </motion.div>
      </div>
    );
  }
);

SwipeableRow.displayName = "SwipeableRow";

export default SwipeableRow;

// ==== Actions (1-3 buttons) ====

const ActionsGroup = ({
  swipeAmount,
  actions,
  swipeProgress,
  commitDelete,
  closeRow,
  actionsWidth,
  focusedIndex,
  isOpen,
  buttonSize,
}: {
  swipeAmount: MotionValue<number>;
  actions: SwipeAction[];
  swipeProgress: MotionValue<number>;
  commitDelete: (a: SwipeAction) => void;
  closeRow: () => void;
  actionsWidth: number;
  focusedIndex: number;
  isOpen: boolean;
  buttonSize: number;
}) => (
  <motion.div
    className="flex h-full items-center justify-end gap-2 pr-3"
    style={{
      position: "absolute",
      height: "100%",
      width: `${actionsWidth}px`,
      left: "100%",
      x: swipeAmount,
      zIndex: 10,
    }}
    onClick={() => {
      if (isOpen) closeRow();
    }}
  >
    {actions.map((a, idx) => (
      <Action
        key={a.key}
        action={a}
        buttonSize={buttonSize}
        closeRow={closeRow}
        commitDelete={commitDelete}
        index={idx}
        isFocused={focusedIndex === idx}
        isOpen={isOpen}
        swipeProgress={swipeProgress}
        totalActions={actions.length}
      />
    ))}
  </motion.div>
);

const Action = ({
  action,
  index,
  totalActions: _totalActions,
  swipeProgress,
  commitDelete,
  closeRow,
  isFocused,
  buttonSize,
  isOpen: _isOpen,
}: {
  action: SwipeAction;
  index: number;
  totalActions: number;
  swipeProgress: MotionValue<number>;
  commitDelete: (a: SwipeAction) => void;
  closeRow: () => void;
  isFocused: boolean;
  buttonSize: number;
  isOpen: boolean;
}) => {
  const { primary, icon: Icon, onPress, label } = action;
  const colors = getActionColors(action);

  // Distinct reveal phases as row opens (progress goes from 0 to negative)
  // Start earlier and complete sooner so all buttons are visible before fully open
  // Button 0 (first): starts at -0.10, fully visible at -0.22 (10-22% open)
  // Button 1 (second): starts at -0.25, fully visible at -0.37 (25-37% open)
  // Button 2 (third): starts at -0.40, fully visible at -0.52 (40-52% open)
  // All buttons visible by 52% open
  const revealStarts = [-0.1, -0.25, -0.4];
  const revealEnds = [-0.22, -0.37, -0.52];

  const startThreshold = revealStarts[index] || -0.1;
  const endThreshold = revealEnds[index] || -0.22;

  // Transform with spring for smooth animation
  const scaleRaw = useTransform(swipeProgress, [0, startThreshold, endThreshold], [0, 0, 1]);

  const opacityRaw = useTransform(swipeProgress, [0, startThreshold, endThreshold], [0, 0, 1]);

  // Apply spring with balanced settings - responsive but smooth
  // Clamp values to prevent NaN from propagating to animations
  const scaleTransform = useSpring(scaleRaw, { stiffness: 300, damping: 25, mass: 0.8 });
  const opacityTransform = useSpring(opacityRaw, { stiffness: 300, damping: 25, mass: 0.8 });

  // Guard against NaN values that can occur during initial render
  const safeScale = useTransform(scaleTransform, (v) => (Number.isFinite(v) ? v : 0));
  const safeOpacity = useTransform(opacityTransform, (v) => (Number.isFinite(v) ? v : 0));

  return (
    <motion.button
      aria-label={label || action.key}
      className={` ${colors.bg} ${colors.hoverBg} ${colors.text} flex cursor-pointer items-center justify-center rounded-full shadow-md transition-opacity duration-150 hover:opacity-90 active:opacity-75 active:shadow-sm ${isFocused ? "ring-2 ring-white ring-offset-2" : ""} `}
      style={{
        scale: safeScale,
        opacity: safeOpacity,
        width: buttonSize,
        height: buttonSize,
      }}
      tabIndex={-1}
      onClick={(e) => {
        e.stopPropagation();
        if (primary) {
          commitDelete(action);
        } else {
          onPress();
          closeRow();
        }
      }}
    >
      <Icon className="h-5 w-5" />
    </motion.button>
  );
};
