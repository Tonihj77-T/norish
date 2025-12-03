import { on } from "events";

import { authedProcedure } from "../../middleware";
import { recipeEmitter } from "../recipes/emitter";
import { router } from "../../trpc";

/**
 * Archive import subscriptions
 */
const onArchiveProgress = authedProcedure.subscription(async function* ({ ctx, signal }) {
  const userId = ctx.user.id;
  const eventName = recipeEmitter.userEvent(userId, "archiveProgress");

  for await (const [data] of on(recipeEmitter, eventName, { signal })) {
    yield data;
  }
});

const onArchiveCompleted = authedProcedure.subscription(async function* ({ ctx, signal }) {
  const userId = ctx.user.id;
  const eventName = recipeEmitter.userEvent(userId, "archiveCompleted");

  for await (const [data] of on(recipeEmitter, eventName, { signal })) {
    yield data;
  }
});

export const archiveSubscriptions = router({
  onArchiveProgress,
  onArchiveCompleted,
});
