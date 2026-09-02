// Generated from definitions/operations.yml. Do not edit.
import type { OperationId } from '@shop/contract';
import { ApiClient } from '../ApiClient';
import { FetchTransport } from '../FetchTransport';
import { bindEventOperation, bindOperation, defineOperation, type EventOperationMethod, type OperationExecutor, type OperationMethod } from '../OperationDescriptor';

export const ORGANIZATION_OPERATION_IDS = Object.freeze([
  "organization.layers.read",
  "organization.stores.read",
  "organization.stores.manage",
  "organization.directories.read",
  "organization.directories.manage",
  "organization.directories.sync",
  "organization.directories.syncruns.read",
  "organization.directoryevents.receive",
] as const satisfies readonly OperationId[]);

export interface OrganizationOperations {
  readonly layersRead: OperationMethod<"organization.layers.read">;
  readonly storesRead: OperationMethod<"organization.stores.read">;
  readonly storesManage: OperationMethod<"organization.stores.manage">;
  readonly directoriesRead: OperationMethod<"organization.directories.read">;
  readonly directoriesManage: OperationMethod<"organization.directories.manage">;
  readonly directoriesSync: OperationMethod<"organization.directories.sync">;
  readonly directoriesSyncrunsRead: OperationMethod<"organization.directories.syncruns.read">;
  readonly directoryeventsReceive: OperationMethod<"organization.directoryevents.receive">;
}

export function createFetchOrganization(baseUrl: string): OrganizationOperations { return createOrganizationOperations(new ApiClient(baseUrl, new FetchTransport())); }

export function createOrganizationOperations(client: OperationExecutor): OrganizationOperations { return Object.freeze({
    layersRead: bindLayersRead(client),
    storesRead: bindStoresRead(client),
    storesManage: bindStoresManage(client),
    directoriesRead: bindDirectoriesRead(client),
    directoriesManage: bindDirectoriesManage(client),
    directoriesSync: bindDirectoriesSync(client),
    directoriesSyncrunsRead: bindDirectoriesSyncrunsRead(client),
    directoryeventsReceive: bindDirectoryeventsReceive(client),
  }); }

export function createFetchOrganizationLayersRead(baseUrl: string): OperationMethod<"organization.layers.read"> { return bindLayersRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindLayersRead(client: OperationExecutor): OperationMethod<"organization.layers.read"> { return bindOperation(client, defineOperation({"id":"organization.layers.read","method":"GET","path":"/api/v1/organizations/layers","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":500})); }

export function createFetchOrganizationStoresRead(baseUrl: string): OperationMethod<"organization.stores.read"> { return bindStoresRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindStoresRead(client: OperationExecutor): OperationMethod<"organization.stores.read"> { return bindOperation(client, defineOperation({"id":"organization.stores.read","method":"GET","path":"/api/v1/organizations/stores","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":500})); }

export function createFetchOrganizationStoresManage(baseUrl: string): OperationMethod<"organization.stores.manage"> { return bindStoresManage(new ApiClient(baseUrl, new FetchTransport())); }

function bindStoresManage(client: OperationExecutor): OperationMethod<"organization.stores.manage"> { return bindOperation(client, defineOperation({"id":"organization.stores.manage","method":"PUT","path":"/api/v1/organizations/stores/{storeid}","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":800})); }

export function createFetchOrganizationDirectoriesRead(baseUrl: string): OperationMethod<"organization.directories.read"> { return bindDirectoriesRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindDirectoriesRead(client: OperationExecutor): OperationMethod<"organization.directories.read"> { return bindOperation(client, defineOperation({"id":"organization.directories.read","method":"GET","path":"/api/v1/organization/directories","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":500})); }

export function createFetchOrganizationDirectoriesManage(baseUrl: string): OperationMethod<"organization.directories.manage"> { return bindDirectoriesManage(new ApiClient(baseUrl, new FetchTransport())); }

function bindDirectoriesManage(client: OperationExecutor): OperationMethod<"organization.directories.manage"> { return bindOperation(client, defineOperation({"id":"organization.directories.manage","method":"PUT","path":"/api/v1/organization/directories/{directoryid}","audience":"console","targets":["console"],"responseMode":"json","idempotent":false,"timeout":1000})); }

export function createFetchOrganizationDirectoriesSync(baseUrl: string): OperationMethod<"organization.directories.sync"> { return bindDirectoriesSync(new ApiClient(baseUrl, new FetchTransport())); }

function bindDirectoriesSync(client: OperationExecutor): OperationMethod<"organization.directories.sync"> { return bindOperation(client, defineOperation({"id":"organization.directories.sync","method":"POST","path":"/api/v1/organization/directories/{directoryid}/syncs","audience":"console","targets":["console"],"responseMode":"json","idempotent":false,"timeout":500})); }

export function createFetchOrganizationDirectoriesSyncrunsRead(baseUrl: string): OperationMethod<"organization.directories.syncruns.read"> { return bindDirectoriesSyncrunsRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindDirectoriesSyncrunsRead(client: OperationExecutor): OperationMethod<"organization.directories.syncruns.read"> { return bindOperation(client, defineOperation({"id":"organization.directories.syncruns.read","method":"GET","path":"/api/v1/organization/directories/{directoryid}/syncruns","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":500})); }

export function createFetchOrganizationDirectoryeventsReceive(baseUrl: string): OperationMethod<"organization.directoryevents.receive"> { return bindDirectoryeventsReceive(new ApiClient(baseUrl, new FetchTransport())); }

function bindDirectoryeventsReceive(client: OperationExecutor): OperationMethod<"organization.directoryevents.receive"> { return bindOperation(client, defineOperation({"id":"organization.directoryevents.receive","method":"POST","path":"/api/v1/organization/directories/{directoryid}/events","audience":"webhook","targets":[],"responseMode":"empty","idempotent":false,"timeout":500})); }
