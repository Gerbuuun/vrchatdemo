// THIS FILE IS AUTOMATICALLY GENERATED BY SPACETIMEDB. EDITS TO THIS FILE
// WILL NOT BE SAVED. MODIFY TABLES IN YOUR MODULE SOURCE CODE INSTEAD.

#![allow(unused, clippy::all)]
use super::tick_schedule_type::TickSchedule;
use spacetimedb_sdk::__codegen::{self as __sdk, __lib, __sats, __ws};

/// Table handle for the table `tick_schedule`.
///
/// Obtain a handle from the [`TickScheduleTableAccess::tick_schedule`] method on [`super::RemoteTables`],
/// like `ctx.db.tick_schedule()`.
///
/// Users are encouraged not to explicitly reference this type,
/// but to directly chain method calls,
/// like `ctx.db.tick_schedule().on_insert(...)`.
pub struct TickScheduleTableHandle<'ctx> {
    imp: __sdk::TableHandle<TickSchedule>,
    ctx: std::marker::PhantomData<&'ctx super::RemoteTables>,
}

#[allow(non_camel_case_types)]
/// Extension trait for access to the table `tick_schedule`.
///
/// Implemented for [`super::RemoteTables`].
pub trait TickScheduleTableAccess {
    #[allow(non_snake_case)]
    /// Obtain a [`TickScheduleTableHandle`], which mediates access to the table `tick_schedule`.
    fn tick_schedule(&self) -> TickScheduleTableHandle<'_>;
}

impl TickScheduleTableAccess for super::RemoteTables {
    fn tick_schedule(&self) -> TickScheduleTableHandle<'_> {
        TickScheduleTableHandle {
            imp: self.imp.get_table::<TickSchedule>("tick_schedule"),
            ctx: std::marker::PhantomData,
        }
    }
}

pub struct TickScheduleInsertCallbackId(__sdk::CallbackId);
pub struct TickScheduleDeleteCallbackId(__sdk::CallbackId);

impl<'ctx> __sdk::Table for TickScheduleTableHandle<'ctx> {
    type Row = TickSchedule;
    type EventContext = super::EventContext;

    fn count(&self) -> u64 {
        self.imp.count()
    }
    fn iter(&self) -> impl Iterator<Item = TickSchedule> + '_ {
        self.imp.iter()
    }

    type InsertCallbackId = TickScheduleInsertCallbackId;

    fn on_insert(
        &self,
        callback: impl FnMut(&Self::EventContext, &Self::Row) + Send + 'static,
    ) -> TickScheduleInsertCallbackId {
        TickScheduleInsertCallbackId(self.imp.on_insert(Box::new(callback)))
    }

    fn remove_on_insert(&self, callback: TickScheduleInsertCallbackId) {
        self.imp.remove_on_insert(callback.0)
    }

    type DeleteCallbackId = TickScheduleDeleteCallbackId;

    fn on_delete(
        &self,
        callback: impl FnMut(&Self::EventContext, &Self::Row) + Send + 'static,
    ) -> TickScheduleDeleteCallbackId {
        TickScheduleDeleteCallbackId(self.imp.on_delete(Box::new(callback)))
    }

    fn remove_on_delete(&self, callback: TickScheduleDeleteCallbackId) {
        self.imp.remove_on_delete(callback.0)
    }
}

#[doc(hidden)]
pub(super) fn register_table(client_cache: &mut __sdk::ClientCache<super::RemoteModule>) {
    let _table = client_cache.get_or_make_table::<TickSchedule>("tick_schedule");
    _table.add_unique_constraint::<u64>("schedule_id", |row| &row.schedule_id);
}
pub struct TickScheduleUpdateCallbackId(__sdk::CallbackId);

impl<'ctx> __sdk::TableWithPrimaryKey for TickScheduleTableHandle<'ctx> {
    type UpdateCallbackId = TickScheduleUpdateCallbackId;

    fn on_update(
        &self,
        callback: impl FnMut(&Self::EventContext, &Self::Row, &Self::Row) + Send + 'static,
    ) -> TickScheduleUpdateCallbackId {
        TickScheduleUpdateCallbackId(self.imp.on_update(Box::new(callback)))
    }

    fn remove_on_update(&self, callback: TickScheduleUpdateCallbackId) {
        self.imp.remove_on_update(callback.0)
    }
}

#[doc(hidden)]
pub(super) fn parse_table_update(
    raw_updates: __ws::TableUpdate<__ws::BsatnFormat>,
) -> __sdk::Result<__sdk::TableUpdate<TickSchedule>> {
    __sdk::TableUpdate::parse_table_update(raw_updates).map_err(|e| {
        __sdk::InternalError::failed_parse("TableUpdate<TickSchedule>", "TableUpdate")
            .with_cause(e)
            .into()
    })
}

/// Access to the `schedule_id` unique index on the table `tick_schedule`,
/// which allows point queries on the field of the same name
/// via the [`TickScheduleScheduleIdUnique::find`] method.
///
/// Users are encouraged not to explicitly reference this type,
/// but to directly chain method calls,
/// like `ctx.db.tick_schedule().schedule_id().find(...)`.
pub struct TickScheduleScheduleIdUnique<'ctx> {
    imp: __sdk::UniqueConstraintHandle<TickSchedule, u64>,
    phantom: std::marker::PhantomData<&'ctx super::RemoteTables>,
}

impl<'ctx> TickScheduleTableHandle<'ctx> {
    /// Get a handle on the `schedule_id` unique index on the table `tick_schedule`.
    pub fn schedule_id(&self) -> TickScheduleScheduleIdUnique<'ctx> {
        TickScheduleScheduleIdUnique {
            imp: self.imp.get_unique_constraint::<u64>("schedule_id"),
            phantom: std::marker::PhantomData,
        }
    }
}

impl<'ctx> TickScheduleScheduleIdUnique<'ctx> {
    /// Find the subscribed row whose `schedule_id` column value is equal to `col_val`,
    /// if such a row is present in the client cache.
    pub fn find(&self, col_val: &u64) -> Option<TickSchedule> {
        self.imp.find(col_val)
    }
}
