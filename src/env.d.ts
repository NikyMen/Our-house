/// <reference path="../.astro/types.d.ts" />

declare namespace App {
  interface Locals {
    /** Usuario de la sesión actual, o null si no está autenticado. */
    user: import('./lib/types').User | null;
  }
}
