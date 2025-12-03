/**
 * HeroUI Tailwind Plugin Configuration
 *
 * This file exports the HeroUI plugin for use with Tailwind CSS v4.
 * It's referenced via the @plugin directive in our CSS.
 */
import { heroui } from "@heroui/react";

// Export the HeroUI plugin with default configuration
// Custom colors are defined in ./theme.css using CSS variables
export default heroui();
