/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as actions from "../actions.js";
import type * as auth from "../auth.js";
import type * as crons from "../crons.js";
import type * as functions from "../functions.js";
import type * as githubAuth from "../githubAuth.js";
import type * as githubWebhooks from "../githubWebhooks.js";
import type * as http from "../http.js";
import type * as jwt from "../jwt.js";
import type * as utils from "../utils.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  actions: typeof actions;
  auth: typeof auth;
  crons: typeof crons;
  functions: typeof functions;
  githubAuth: typeof githubAuth;
  githubWebhooks: typeof githubWebhooks;
  http: typeof http;
  jwt: typeof jwt;
  utils: typeof utils;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
