// THIS FILE IS AUTOMATICALLY GENERATED BY SPACETIMEDB. EDITS TO THIS FILE
// WILL NOT BE SAVED. MODIFY TABLES IN YOUR MODULE SOURCE CODE INSTEAD.

/* eslint-disable */
/* tslint:disable */
// @ts-nocheck
import {
  AlgebraicType,
  AlgebraicValue,
  BinaryReader,
  BinaryWriter,
  CallReducerFlags,
  ConnectionId,
  DbConnectionBuilder,
  DbConnectionImpl,
  DbContext,
  ErrorContextInterface,
  Event,
  EventContextInterface,
  Identity,
  ProductType,
  ProductTypeElement,
  ReducerEventContextInterface,
  SubscriptionBuilderImpl,
  SubscriptionEventContextInterface,
  SumType,
  SumTypeVariant,
  TableCache,
  TimeDuration,
  Timestamp,
  deepEqual,
} from "@clockworklabs/spacetimedb-sdk";
import { Collider } from "./collider_type";
import { DbVector3 as __DbVector3 } from "./db_vector_3_type";

import { EventContext, Reducer, RemoteReducers, RemoteTables } from ".";

/**
 * Table handle for the table `collider`.
 *
 * Obtain a handle from the [`collider`] property on [`RemoteTables`],
 * like `ctx.db.collider`.
 *
 * Users are encouraged not to explicitly reference this type,
 * but to directly chain method calls,
 * like `ctx.db.collider.on_insert(...)`.
 */
export class ColliderTableHandle {
  tableCache: TableCache<Collider>;

  constructor(tableCache: TableCache<Collider>) {
    this.tableCache = tableCache;
  }

  count(): number {
    return this.tableCache.count();
  }

  iter(): Iterable<Collider> {
    return this.tableCache.iter();
  }
  /**
   * Access to the `id` unique index on the table `collider`,
   * which allows point queries on the field of the same name
   * via the [`ColliderIdUnique.find`] method.
   *
   * Users are encouraged not to explicitly reference this type,
   * but to directly chain method calls,
   * like `ctx.db.collider.id().find(...)`.
   *
   * Get a handle on the `id` unique index on the table `collider`.
   */
  id = {
    // Find the subscribed row whose `id` column value is equal to `col_val`,
    // if such a row is present in the client cache.
    find: (col_val: number): Collider | undefined => {
      for (let row of this.tableCache.iter()) {
        if (deepEqual(row.id, col_val)) {
          return row;
        }
      }
    },
  };

  onInsert = (cb: (ctx: EventContext, row: Collider) => void) => {
    return this.tableCache.onInsert(cb);
  }

  removeOnInsert = (cb: (ctx: EventContext, row: Collider) => void) => {
    return this.tableCache.removeOnInsert(cb);
  }

  onDelete = (cb: (ctx: EventContext, row: Collider) => void) => {
    return this.tableCache.onDelete(cb);
  }

  removeOnDelete = (cb: (ctx: EventContext, row: Collider) => void) => {
    return this.tableCache.removeOnDelete(cb);
  }

  // Updates are only defined for tables with primary keys.
  onUpdate = (cb: (ctx: EventContext, oldRow: Collider, newRow: Collider) => void) => {
    return this.tableCache.onUpdate(cb);
  }

  removeOnUpdate = (cb: (ctx: EventContext, onRow: Collider, newRow: Collider) => void) => {
    return this.tableCache.removeOnUpdate(cb);
  }}
