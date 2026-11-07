// @ts-nocheck
/* eslint-disable */
import { twMerge } from "tailwind-merge";
import { clsx } from "clsx";
import { cva } from "class-variance-authority";
import * as import_react from "react";
import * as import_jsx_runtime from "react/jsx-runtime";
import { Slot } from "@radix-ui/react-slot";
import { Root as Dialog$1, Portal as DialogPortal$1, Overlay as DialogOverlay$1, Content as DialogContent$1, Close as DialogClose, Title as DialogTitle$1, Description as DialogDescription$1 } from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { Root as Switch$1, Thumb as SwitchThumb } from "@radix-ui/react-switch";

function cn(...inputs) {
  return twMerge(clsx(inputs));
}
var buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline:
          "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        ink: "bg-ink text-on-ink hover:bg-ink/85 shadow-sm",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);
export var Button = import_react.forwardRef(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      asChild ? Slot : "button",
      {
        className: cn(
          buttonVariants({
            variant,
            size,
            className,
          }),
        ),
        ref,
        ...props,
      },
    );
  },
);
Button.displayName = "Button";
export var Dialog = Dialog$1;
var DialogPortal = DialogPortal$1;
var DialogOverlay = import_react.forwardRef(({ className, ...props }, ref) =>
  /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogOverlay$1, {
    ref,
    className: cn(
      "fixed inset-0 z-50 bg-overlay data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    ),
    ...props,
  }),
);
DialogOverlay.displayName = DialogOverlay$1.displayName;
export var DialogContent = import_react.forwardRef(
  ({ className, children, ...props }, ref) =>
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogPortal, {
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogOverlay, {}),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent$1, {
          ref,
          className: cn(
            "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:rounded-lg",
            className,
          ),
          ...props,
          children: [
            children,
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogClose, {
              className:
                "absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background cursor-pointer transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground",
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, {
                  className: "h-4 w-4",
                }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
                  className: "sr-only",
                  children: "Close",
                }),
              ],
            }),
          ],
        }),
      ],
    }),
);
DialogContent.displayName = DialogContent$1.displayName;
var DialogHeader = ({ className, ...props }) =>
  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
    className: cn(
      "flex flex-col space-y-1.5 text-center sm:text-left",
      className,
    ),
    ...props,
  });
DialogHeader.displayName = "DialogHeader";
var DialogFooter = ({ className, ...props }) =>
  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
    className: cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className,
    ),
    ...props,
  });
DialogFooter.displayName = "DialogFooter";
export var DialogTitle = import_react.forwardRef(({ className, ...props }, ref) =>
  /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle$1, {
    ref,
    className: cn(
      "text-lg font-semibold leading-none tracking-tight",
      className,
    ),
    ...props,
  }),
);
DialogTitle.displayName = DialogTitle$1.displayName;
export var DialogDescription = import_react.forwardRef(
  ({ className, ...props }, ref) =>
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogDescription$1, {
      ref,
      className: cn("text-sm text-muted-foreground", className),
      ...props,
    }),
);
DialogDescription.displayName = DialogDescription$1.displayName;
export var Switch = import_react.forwardRef(({ className, ...props }, ref) =>
  /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch$1, {
    className: cn(
      "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input",
      className,
    ),
    ...props,
    ref,
    children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SwitchThumb, {
      className: cn(
        "pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-4 rtl:data-[state=checked]:-translate-x-4 data-[state=unchecked]:translate-x-0",
      ),
    }),
  }),
);
Switch.displayName = Switch$1.displayName;
