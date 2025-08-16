/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as actions from "../actions.js";
import type * as auth from "../auth.js";
import type * as crons from "../crons.js";
import type * as debug from "../debug.js";
import type * as env from "../env.js";
import type * as http from "../http.js";
import type * as migrations from "../migrations.js";
import type * as models_authAccounts from "../models/authAccounts.js";
import type * as models_blobs from "../models/blobs.js";
import type * as models_commits from "../models/commits.js";
import type * as models_issueComments from "../models/issueComments.js";
import type * as models_issues from "../models/issues.js";
import type * as models_models from "../models/models.js";
import type * as models_pats from "../models/pats.js";
import type * as models_refs from "../models/refs.js";
import type * as models_repoCounts from "../models/repoCounts.js";
import type * as models_repoDownloadStatus from "../models/repoDownloadStatus.js";
import type * as models_repos from "../models/repos.js";
import type * as models_treeEntries from "../models/treeEntries.js";
import type * as models_trees from "../models/trees.js";
import type * as models_userRepos from "../models/userRepos.js";
import type * as models_users from "../models/users.js";
import type * as mutations from "../mutations.js";
import type * as queries from "../queries.js";
import type * as services_backfill from "../services/backfill.js";
import type * as services_github from "../services/github.js";
import type * as services_repoPageService from "../services/repoPageService.js";
import type * as services_sync from "../services/sync.js";
import type * as shared from "../shared.js";
import type * as utils from "../utils.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

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
  debug: typeof debug;
  env: typeof env;
  http: typeof http;
  migrations: typeof migrations;
  "models/authAccounts": typeof models_authAccounts;
  "models/blobs": typeof models_blobs;
  "models/commits": typeof models_commits;
  "models/issueComments": typeof models_issueComments;
  "models/issues": typeof models_issues;
  "models/models": typeof models_models;
  "models/pats": typeof models_pats;
  "models/refs": typeof models_refs;
  "models/repoCounts": typeof models_repoCounts;
  "models/repoDownloadStatus": typeof models_repoDownloadStatus;
  "models/repos": typeof models_repos;
  "models/treeEntries": typeof models_treeEntries;
  "models/trees": typeof models_trees;
  "models/userRepos": typeof models_userRepos;
  "models/users": typeof models_users;
  mutations: typeof mutations;
  queries: typeof queries;
  "services/backfill": typeof services_backfill;
  "services/github": typeof services_github;
  "services/repoPageService": typeof services_repoPageService;
  "services/sync": typeof services_sync;
  shared: typeof shared;
  utils: typeof utils;
}>;
declare const fullApiWithMounts: typeof fullApi;

export declare const api: FilterApi<
  typeof fullApiWithMounts,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApiWithMounts,
  FunctionReference<any, "internal">
>;

export declare const components: {
  migrations: {
    lib: {
      cancel: FunctionReference<
        "mutation",
        "internal",
        { name: string },
        {
          batchSize?: number;
          cursor?: string | null;
          error?: string;
          isDone: boolean;
          latestEnd?: number;
          latestStart: number;
          name: string;
          next?: Array<string>;
          processed: number;
          state: "inProgress" | "success" | "failed" | "canceled" | "unknown";
        }
      >;
      cancelAll: FunctionReference<
        "mutation",
        "internal",
        { sinceTs?: number },
        Array<{
          batchSize?: number;
          cursor?: string | null;
          error?: string;
          isDone: boolean;
          latestEnd?: number;
          latestStart: number;
          name: string;
          next?: Array<string>;
          processed: number;
          state: "inProgress" | "success" | "failed" | "canceled" | "unknown";
        }>
      >;
      clearAll: FunctionReference<
        "mutation",
        "internal",
        { before?: number },
        null
      >;
      getStatus: FunctionReference<
        "query",
        "internal",
        { limit?: number; names?: Array<string> },
        Array<{
          batchSize?: number;
          cursor?: string | null;
          error?: string;
          isDone: boolean;
          latestEnd?: number;
          latestStart: number;
          name: string;
          next?: Array<string>;
          processed: number;
          state: "inProgress" | "success" | "failed" | "canceled" | "unknown";
        }>
      >;
      migrate: FunctionReference<
        "mutation",
        "internal",
        {
          batchSize?: number;
          cursor?: string | null;
          dryRun: boolean;
          fnHandle: string;
          name: string;
          next?: Array<{ fnHandle: string; name: string }>;
        },
        {
          batchSize?: number;
          cursor?: string | null;
          error?: string;
          isDone: boolean;
          latestEnd?: number;
          latestStart: number;
          name: string;
          next?: Array<string>;
          processed: number;
          state: "inProgress" | "success" | "failed" | "canceled" | "unknown";
        }
      >;
    };
  };
};
