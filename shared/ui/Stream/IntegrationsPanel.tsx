import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import ScrollBox from "./ScrollBox";
import styled from "styled-components";
import { includes as _includes, sortBy as _sortBy, last as _last } from "lodash-es";
import { CodeStreamState } from "../store";
import { useDidMount } from "../utilities/hooks";
import { HostApi } from "../webview-api";
import { PanelHeader } from "../src/components/PanelHeader";
import { PROVIDER_MAPPINGS } from "./CrossPostIssueControls/types";
import { isConnected, getConnectedSharingTargets } from "../store/providers/reducer";
import { openPanel, disconnectProvider, connectProvider, closePanel } from "./actions";
import Icon from "./Icon";
import { Button } from "../src/components/Button";
import { DropdownButton } from "./Review/DropdownButton";
import { PrePRProviderInfoModal } from "./PrePRProviderInfoModal";

const Provider = styled(Button)`
	width: 100%;
	justify-content: left;
	text-align: left;
	.icon {
		margin-right: 5px;
	}
`;

const ProviderDropdown = styled(DropdownButton)`
	width: 100%;
	button {
		width: 100%;
		justify-content: left;
		text-align: left;
		.icon {
			margin-right: 5px;
		}
		.chevron-down {
			float: right;
			margin-right: 0;
		}
		> span {
			width: 100%;
		}
	}
`;

const IntegrationGroups = styled.div`
	padding: 0 10px 20px 20px;
	.title {
		top: -16px !important;
	}
	h2 {
		margin-top: 0;
		font-size: 16px !important;
	}
`;

const IntegrationButtons = styled.div`
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(12em, 1fr));
	column-gap: 15px;
	row-gap: 10px;
	margin-bottom: 40px;
`;

export const IntegrationsPanel = () => {
	const dispatch = useDispatch();
	const derivedState = useSelector((state: CodeStreamState) => {
		const { providers } = state;

		const connectedProviders = Object.keys(providers).filter(id => isConnected(state, { id }));
		const codeHostProviders = Object.keys(providers)
			.filter(id =>
				["github", "github_enterprise", "bitbucket", "gitlab", "gitlab_enterprise"].includes(
					providers[id].name
				)
			)
			.filter(id => !connectedProviders.includes(id));
		const issueProviders = Object.keys(providers)
			.filter(id => providers[id].hasIssues)
			.filter(id => !codeHostProviders.includes(id))
			.filter(id => !connectedProviders.includes(id));
		const messagingProviders = Object.keys(providers).filter(id => providers[id].hasSharing);
		const sharingTargets = getConnectedSharingTargets(state);

		return {
			webviewFocused: state.context.hasFocus,
			providers,
			codeHostProviders,
			issueProviders,
			messagingProviders,
			connectedProviders,
			sharingTargets
		};
	});

	const [propsForPrePRProviderInfoModal, setPropsForPrePRProviderInfoModal] = useState<any>();

	const renderDisplayHost = host => {
		return host.startsWith("http://")
			? host.split("http://")[1]
			: host.startsWith("https://")
			? host.split("https://")[1]
			: host;
	};

	const renderConnectedProviders = providerIds => {
		const { providers, connectedProviders } = derivedState;
		return providerIds.map(providerId => {
			const provider = providers[providerId];
			const { name, isEnterprise, host, needsConfigure, forEnterprise } = provider;
			const display = PROVIDER_MAPPINGS[name];
			if (!display) return null;

			if (provider.hasSharing) {
				return derivedState.sharingTargets.map(shareTarget => {
					if (shareTarget.providerId !== provider.id) return null;

					const items = [
						{
							label: "Disconnect",
							action: () =>
								dispatch(disconnectProvider(providerId, "Integrations Panel", shareTarget.teamId))
						}
					];
					return (
						<ProviderDropdown key={providerId} items={items}>
							{display.icon && <Icon name={display.icon} />}
							{shareTarget.teamName}
						</ProviderDropdown>
					);
				});
			}

			const displayHost = renderDisplayHost(host);
			const displayName = isEnterprise
				? `${display.displayName} - ${displayHost}`
				: display.displayName;
			const items = [
				{
					label: "Disconnect",
					action: () => dispatch(disconnectProvider(providerId, "Integrations Panel"))
				}
			];
			return (
				<ProviderDropdown key={providerId} items={items}>
					{display.icon && <Icon name={display.icon} />}
					{displayName}
				</ProviderDropdown>
			);
		});
	};

	const renderProviders = providerIds => {
		const { providers, connectedProviders } = derivedState;
		return providerIds.map(providerId => {
			const provider = providers[providerId];
			const { name, isEnterprise, host, needsConfigure, forEnterprise } = provider;
			const display = PROVIDER_MAPPINGS[name];
			if (!display) return null;

			const displayHost = renderDisplayHost(host);
			const displayName = isEnterprise
				? `${display.displayName} - ${displayHost}`
				: display.displayName;
			let action;
			if (needsConfigure) {
				// otherwise, if it's a provider that needs to be pre-configured,
				// bring up the custom popup for configuring it
				action = () =>
					dispatch(openPanel(`configure-provider-${name}-${providerId}-Integrations Panel`));
			} else if (forEnterprise) {
				// otherwise if it's for an enterprise provider, configure for enterprise
				action = () => {
					dispatch(openPanel(`configure-enterprise-${name}-${providerId}-Integrations Panel`));
				};
			} else {
				// otherwise it's just a simple oauth redirect
				if (name === "github" || name === "bitbucket" || name === "gitlab") {
					action = () =>
						setPropsForPrePRProviderInfoModal({
							providerName: name,
							action: () => dispatch(connectProvider(providerId, "Integrations Panel")),
							onClose: () => setPropsForPrePRProviderInfoModal(undefined)
						});
				} else action = () => dispatch(connectProvider(providerId, "Integrations Panel"));
			}
			return (
				<Provider key={providerId} onClick={action}>
					{display.icon && <Icon name={display.icon} />}
					{displayName}
				</Provider>
			);
		});
	};

	const renderMessagingProviders = () => {
		const { providers, connectedProviders } = derivedState;
		return derivedState.messagingProviders.map(providerId => {
			const provider = providers[providerId];
			const { name } = provider;
			const display = PROVIDER_MAPPINGS[name];
			if (!display) return null;

			let elements = [] as any;
			if (connectedProviders.includes(providerId)) {
				elements.push(
					<Provider onClick={() => dispatch(connectProvider(providerId, "Integrations Panel"))}>
						{display.icon && <Icon name={display.icon} />}
						{`Add ${display.groupName}`}
					</Provider>
				);
			} else
				elements.push(
					<Provider
						key={providerId}
						onClick={() => dispatch(connectProvider(providerId, "Integrations Panel"))}
					>
						{display.icon && <Icon name={display.icon} />}
						{display.displayName}
					</Provider>
				);
			return elements;
		});
	};

	useDidMount(() => {
		if (derivedState.webviewFocused)
			HostApi.instance.track("Page Viewed", { "Page Name": "Integrations" });
	});

	if (propsForPrePRProviderInfoModal) {
		return <PrePRProviderInfoModal {...propsForPrePRProviderInfoModal} />;
	}

	return (
		<div className="panel full-height activity-panel">
			<PanelHeader title={<>&nbsp;</>}></PanelHeader>
			<ScrollBox>
				<div className="channel-list vscroll">
					<IntegrationGroups>
						{Object.keys(derivedState.providers).length === 0 && (
							<>
								<h2>HTTPS Required</h2>
								CodeStream integrations require a secure connection to your CodeStream server.
								Please contact your on-prem CodeStream administrator.
								<br />
								<br />
								<Button onClick={() => dispatch(closePanel())}>OK</Button>
							</>
						)}
						{Object.keys(derivedState.providers).length > 0 && (
							<>
								<h2>Active Integrations</h2>
								<IntegrationButtons>
									{renderConnectedProviders(derivedState.connectedProviders)}
								</IntegrationButtons>

								<h2>Code Host &amp; Issue Providers</h2>
								<IntegrationButtons>
									{renderProviders(derivedState.codeHostProviders)}
								</IntegrationButtons>

								<h2>Issue Providers</h2>
								<IntegrationButtons>
									{renderProviders(derivedState.issueProviders)}
								</IntegrationButtons>

								<h2>Messaging Providers</h2>
								<IntegrationButtons>{renderMessagingProviders()}</IntegrationButtons>
							</>
						)}
					</IntegrationGroups>
				</div>
			</ScrollBox>
		</div>
	);
};
