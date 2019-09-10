import { action } from "../common";
import { SessionActionType, SessionState } from "./types";
import { HostApi } from "../../webview-api";
import { reset } from "../actions";
import { LogoutRequestType } from "@codestream/protocols/webview";
import { setBootstrapped } from "../bootstrapped/actions";
import {
	TokenLoginRequestType,
	GetAccessTokenRequestType,
	isLoginFailResponse
} from "@codestream/protocols/agent";
import { CodeStreamState } from "../index";
import { CSMe } from "@codestream/protocols/api";
import { onLogin } from "@codestream/webview/Authentication/actions";
import { logError } from "@codestream/webview/logger";

export { reset };

export const setSession = (session: Partial<SessionState>) =>
	action(SessionActionType.Set, session);

export const logout = () => async dispatch => {
	dispatch(setBootstrapped(false));
	await HostApi.instance.send(LogoutRequestType, {});
	dispatch(reset());
	dispatch(setBootstrapped(true));
};

export const switchToTeam = (id: string) => async (dispatch, getState: () => CodeStreamState) => {
	const { accessToken } = await HostApi.instance.send(GetAccessTokenRequestType, {});

	const { configs, users, session } = getState();
	const user = users[session.userId!] as CSMe;

	dispatch(setBootstrapped(false));
	dispatch(reset());

	await HostApi.instance.send(LogoutRequestType, {});
	const response = await HostApi.instance.send(TokenLoginRequestType, {
		token: { email: user.email, value: accessToken, url: configs.serverUrl, teamId: id },
		teamId: id
	});

	if (isLoginFailResponse(response)) {
		logError("Failed to switch teams", { ...response, userId: user.id, email: user.email });
		return dispatch(setBootstrapped(true));
	}

	return dispatch(onLogin(response));
};
