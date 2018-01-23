import { upsert } from "../local-cache";
import { normalize } from "./utils";
import { saveMarkers } from "./marker";
import { saveMarkerLocations } from "./marker-location";

const createTempId = (() => {
	let count = 0;
	return () => String(count++);
})();

export const savePost = attributes => (dispatch, getState, { db }) => {
	return upsert(db, "posts", attributes).then(post =>
		dispatch({
			type: "ADD_POST",
			payload: post
		})
	);
};

export const savePosts = attributes => (dispatch, getState, { db }) => {
	return upsert(db, "posts", attributes).then(posts =>
		dispatch({
			type: "ADD_POSTS",
			payload: posts
		})
	);
};

export const savePostsForStream = (streamId, attributes) => (dispatch, getState, { db }) => {
	return upsert(db, "posts", attributes).then(posts =>
		dispatch({
			type: "ADD_POSTS_FOR_STREAM",
			payload: { streamId, posts }
		})
	);
};

export const savePendingPost = attributes => (dispatch, getState, { db }) => {
	return upsert(db, "posts", attributes).then(post => {
		dispatch({
			type: "ADD_PENDING_POST",
			payload: post
		});
	});
};

export const resolvePendingPost = (id, { post, markers, markerLocations }) => (
	dispatch,
	getState,
	{ db }
) => {
	return db
		.transaction("rw", db.posts, async () => {
			await db.posts.delete(id);
			dispatch({
				type: "RESOLVE_PENDING_POST",
				payload: {
					pendingId: id,
					post
				}
			});
			await dispatch(savePost(post));
		})
		.then(async () => {
			// TODO: Should these be saved? the updates will be published through pubnub and cause double updates
			// await dispatch(saveMarkers(markers));
			// await dispatch(saveMarkerLocations(markerLocations));
		});
};

export const rejectPendingPost = (streamId, pendingId, post) => (dispatch, getState, { db }) => {
	// TODO
};

export const fetchPosts = ({ streamId, teamId }) => async (dispatch, getState, { db, http }) => {
	const { session } = getState();
	const { posts } = await http.get(
		`/posts?teamId=${teamId}&streamId=${streamId}`,
		session.accessToken
	);
	return dispatch(savePostsForStream(streamId, normalize(posts)));
};

export const createPost = (streamId, parentPostId, text, codeBlocks) => async (
	dispatch,
	getState,
	{ http }
) => {
	const { session, context } = getState();
	const pendingId = createTempId();

	let post = {
		id: pendingId,
		teamId: context.currentTeamId,
		timestamp: new Date().getTime(),
		creatorId: session.userId,
		parentPostId: parentPostId,
		codeBlocks: codeBlocks,
		commitHashWhenPosted: context.currentCommit,
		streamId,
		text
	};

	dispatch(savePendingPost(post));

	try {
		const data = await http.post("/posts", post, session.accessToken);
		dispatch(
			resolvePendingPost(pendingId, {
				post: normalize(data.post),
				markers: normalize(data.markers),
				markerLocations: data.markerLocations
			})
		);
	} catch (error) {
		// TODO: different types of errors?
		dispatch(rejectPendingPost(streamId, pendingId, { ...post, error: true }));
	}
};
