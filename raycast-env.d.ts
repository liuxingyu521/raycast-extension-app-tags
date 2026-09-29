/// <reference types="@raycast/api">

/* 🚧 🚧 🚧
 * This file is auto-generated from the extension's manifest.
 * Do not modify manually. Instead, update the `package.json` file.
 * 🚧 🚧 🚧 */

/* eslint-disable @typescript-eslint/ban-types */

type ExtensionPreferences = {}

/** Preferences accessible in all the extension's commands */
declare type Preferences = ExtensionPreferences

declare namespace Preferences {
  /** Preferences accessible in the `search-apps` command */
  export type SearchApps = ExtensionPreferences & {}
  /** Preferences accessible in the `manage-tags` command */
  export type ManageTags = ExtensionPreferences & {}
}

declare namespace Arguments {
  /** Arguments passed to the `search-apps` command */
  export type SearchApps = {
  /** 标签或应用名 */
  "query": string
}
  /** Arguments passed to the `manage-tags` command */
  export type ManageTags = {}
}

