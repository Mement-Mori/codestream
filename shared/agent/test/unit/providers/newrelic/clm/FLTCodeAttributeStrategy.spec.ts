"use strict";

import { NewRelicProvider } from "../../../../../src/providers/newrelic";
import { CSMe } from "@codestream/protocols/api";
import { Dictionary } from "lodash";
import {
	Entity,
	GetEntityCountResponse,
	ObservabilityRepo,
	RelatedEntity,
	RelatedEntityByRepositoryGuidsResult,
} from "@codestream/protocols/agent";
import {
	MetricQueryRequest,
	MetricTimeslice,
	Span,
} from "../../../../../src/providers/newrelic/newrelic.types";
import { FLTCodeAttributeStrategy } from "../../../../../src/providers/newrelic/clm/FLTCodeAttributeStrategy";

describe("FLTCodeAttributeStrategy", () => {
	describe("addMethodName", () => {
		it("parses python function name", async () => {
			const provider = new NewRelicProviderStub({} as any, {} as any);
			const strategy = new FLTCodeAttributeStrategy(
				"entityGuid",
				1,
				"python",
				"/foo/bar.py",
				{
					fileUri: "/foo/bar.py",
					languageId: "python",
				},
				"locator",
				provider
			);
			const results = strategy.addMethodName(
				{
					"Function/routes.app:hello_world": [
						{
							traceId: "123",
							transactionId: "abc",
							"code.lineno": 1,
							"code.namespace": null,
							"transaction.name": "a",
							"code.function": "hello_world",
						},
					],
					"Function/routes.app:MyClass.my_method": [
						{
							traceId: "456",
							transactionId: "def",
							"code.lineno": 4,
							"code.namespace": null,
							"transaction.name": "d",
							"code.function": "my_method",
						},
					],
				},
				[
					{
						facet: "Function/routes.app:hello_world",
						averageDuration: 3.2,
						metricTimesliceName: "Function/routes.app:hello_world",
					},
					{
						facet: "Function/routes.app:MyClass.my_method",
						averageDuration: 3.2,
						metricTimesliceName: "Function/routes.app:MyClass.my_method",
					},
				]
			);

			expect(results).toEqual([
				{
					averageDuration: 3.2,
					className: undefined,
					facet: "Function/routes.app:hello_world",
					metricTimesliceName: "Function/routes.app:hello_world",
					namespace: null,
					metadata: {
						"code.lineno": 1,
						traceId: "123",
						transactionId: "abc",
						"code.namespace": null,
						"code.function": "hello_world",
					},
					functionName: "hello_world",
				},
				{
					averageDuration: 3.2,
					facet: "Function/routes.app:MyClass.my_method",
					className: "MyClass",
					metricTimesliceName: "Function/routes.app:MyClass.my_method",
					namespace: null,
					metadata: {
						"code.lineno": 4,
						traceId: "456",
						transactionId: "def",
						"code.namespace": null,
						"code.function": "my_method",
					},
					functionName: "my_method",
				},
			]);
		});

		it("maps python code.namespace", async () => {
			const provider = new NewRelicProviderStub({} as any, {} as any);
			const strategy = new FLTCodeAttributeStrategy(
				"entityGuid",
				1,
				"python",
				"/foo/bar.py",
				{
					fileUri: "/foo/bar.py",
					languageId: "python",
				},
				"locator",
				provider
			);
			const results = strategy.addMethodName(
				{
					"Carrot/foo_bar.system.tasks.bill_credit_payment_item": [
						{
							"code.filepath": "/app/foo_bar/system/tasks.py",
							"code.function": "bill_credit_payment_item",
							"code.lineno": 27,
							"code.namespace": "foo_bar.system.tasks",
							timestamp: 1647628200280,
						},
					],
				},
				[
					{
						facet: "OtherTransaction/Carrot/foo_bar.system.tasks.bill_credit_payment_item",
						averageDuration: 3.2,
						metricTimesliceName:
							"OtherTransaction/Carrot/foo_bar.system.tasks.bill_credit_payment_item",
					},
				]
			);

			expect(results).toEqual([
				{
					averageDuration: 3.2,
					className: undefined,
					facet: "OtherTransaction/Carrot/foo_bar.system.tasks.bill_credit_payment_item",
					metricTimesliceName:
						"OtherTransaction/Carrot/foo_bar.system.tasks.bill_credit_payment_item",
					namespace: "foo_bar.system.tasks",
					metadata: {
						"code.lineno": 27,
						"code.namespace": "foo_bar.system.tasks",
						traceId: undefined,
						transactionId: undefined,
						"code.function": "bill_credit_payment_item",
					},
					functionName: "bill_credit_payment_item",
				},
			]);
		});

		it("handles ruby controller", () => {
			const provider = new NewRelicProviderStub({} as any, {} as any);
			const strategy = new FLTCodeAttributeStrategy(
				"entityGuid",
				1,
				"ruby",
				"/foo/bar.rb",
				{
					fileUri: "/foo/bar.rb",
					languageId: "ruby",
				},
				"locator",
				provider
			);
			const groupedByTransactionName = {
				"Controller/agents/show": [
					{
						"code.lineno": 16,
						"code.namespace": "AgentsController",
						"code.function": "show",
						name: "Controller/agents/show",
						timestamp: 1651192630939,
						traceId: "289d61d8564a72ef01bcea7b76b95ca4",
						"transaction.name": null,
						transactionId: "5195e0f31cf1fce4",
					},
				],
				"Controller/agents/create": [
					{
						"code.lineno": 16,
						"code.namespace": "AgentsController",
						"code.function": "create",
						name: "Controller/agents/create",
						timestamp: 1651192612236,
						traceId: "67e121ac35ff1cbe191fd1da94e50012",
						"transaction.name": null,
						transactionId: "2ac9f995b004df82",
					},
				],
				"Controller/agents/destroy": [
					{
						"code.lineno": 55,
						"code.namespace": "AgentsController",
						"code.function": "destroy",
						name: "Controller/agents/destroy",
						timestamp: 1651192599849,
						traceId: "063c6612799ad82201ee739f4213ff39",
						"transaction.name": null,
						transactionId: "43d95607af1fa91f",
					},
				],
			};

			const metricTimesliceNames: MetricTimeslice[] = [
				{
					facet: "Controller/agents/create",
					metricTimesliceName: "Controller/agents/create",
					requestsPerMinute: 22.2,
				},
				{
					facet: "Controller/agents/show",
					metricTimesliceName: "Controller/agents/show",
					requestsPerMinute: 22.2,
				},
				{
					facet: "Controller/agents/destroy",
					metricTimesliceName: "Controller/agents/destroy",
					requestsPerMinute: 22.23,
				},
			];

			const results = strategy.addMethodName(groupedByTransactionName, metricTimesliceNames);
			expect(results).toEqual([
				{
					className: "AgentsController",
					facet: "Controller/agents/create",
					metricTimesliceName: "Controller/agents/create",
					namespace: "AgentsController",
					requestsPerMinute: 22.2,
					metadata: {
						"code.lineno": 16,
						traceId: "67e121ac35ff1cbe191fd1da94e50012",
						transactionId: "2ac9f995b004df82",
						"code.namespace": "AgentsController",
						"code.function": "create",
					},
					functionName: "create",
				},
				{
					className: "AgentsController",
					facet: "Controller/agents/show",
					metricTimesliceName: "Controller/agents/show",
					requestsPerMinute: 22.2,
					namespace: "AgentsController",
					metadata: {
						"code.lineno": 16,
						traceId: "289d61d8564a72ef01bcea7b76b95ca4",
						transactionId: "5195e0f31cf1fce4",
						"code.namespace": "AgentsController",
						"code.function": "show",
					},
					functionName: "show",
				},
				{
					className: "AgentsController",
					facet: "Controller/agents/destroy",
					metricTimesliceName: "Controller/agents/destroy",
					requestsPerMinute: 22.23,
					namespace: "AgentsController",
					metadata: {
						"code.lineno": 55,
						traceId: "063c6612799ad82201ee739f4213ff39",
						transactionId: "43d95607af1fa91f",
						"code.namespace": "AgentsController",
						"code.function": "destroy",
					},
					functionName: "destroy",
				},
			]);
			// console.info("result", JSON.stringify(result, null, 2));
		});

		it("handles ruby ActiveJob", () => {
			const provider = new NewRelicProviderStub({} as any, {} as any);
			const strategy = new FLTCodeAttributeStrategy(
				"entityGuid",
				1,
				"ruby",
				"/foo/bar.rb",
				{
					fileUri: "/foo/bar.rb",
					languageId: "ruby",
				},
				"locator",
				provider
			);
			const groupedByTransactionName = {
				"MessageBroker/ActiveJob::Async/Queue/Produce/Named/default": [
					{
						"code.filepath": "/usr/src/app/app/jobs/notifier_job.rb",
						"code.function": "perform",
						"code.lineno": 8,
						"code.namespace": "NotifierJob",
						name: "MessageBroker/ActiveJob::Async/Queue/Produce/Named/default",
						timestamp: 1652110848694,
						traceId: "2d2a1cfae193394b121427ff11df5fc5",
						"transaction.name": null,
						transactionId: "5154409dd464aad1",
					},
					{
						"code.filepath": "/usr/src/app/app/jobs/notifier_job.rb",
						"code.function": "perform",
						"code.lineno": 8,
						"code.namespace": "NotifierJob",
						name: "MessageBroker/ActiveJob::Async/Queue/Produce/Named/default",
						timestamp: 1652110782764,
						traceId: "84ea3aebfc980a997ae65beefad3a208",
						"transaction.name": null,
						transactionId: "d120d392b5ab777f",
					},
				],
			};

			const metricTimesliceNames: MetricTimeslice[] = [
				{
					facet: "MessageBroker/ActiveJob::Async/Queue/Produce/Named/default",
					requestsPerMinute: 24.1,
					metricTimesliceName: "MessageBroker/ActiveJob::Async/Queue/Produce/Named/default",
				},
			];

			const results = strategy.addMethodName(groupedByTransactionName, metricTimesliceNames);
			expect(results).toEqual([
				{
					className: "NotifierJob",
					facet: "MessageBroker/ActiveJob::Async/Queue/Produce/Named/default",
					metricTimesliceName: "MessageBroker/ActiveJob::Async/Queue/Produce/Named/default",
					namespace: "NotifierJob",
					requestsPerMinute: 24.1,
					metadata: {
						"code.lineno": 8,
						traceId: "2d2a1cfae193394b121427ff11df5fc5",
						transactionId: "5154409dd464aad1",
						"code.namespace": "NotifierJob",
						"code.function": "perform",
					},
					functionName: "perform",
				},
			]);
		});

		it("parses ruby modules:class:functions syntax", () => {
			const provider = new NewRelicProviderStub({} as any, {} as any);
			const strategy = new FLTCodeAttributeStrategy(
				"entityGuid",
				1,
				"ruby",
				"/foo/bar.rb",
				{
					fileUri: "/foo/bar.rb",
					languageId: "ruby",
				},
				"locator",
				provider
			);
			const groupedByTransactionName: Dictionary<Span[]> = {
				"Nested/OtherTransaction/Background/Custom::Helpers/custom_class_method": [
					{
						"code.lineno": "11",
						"code.namespace": "Custom::Helpers",
						"code.function": "custom_class_method",
						name: "OtherTransaction/Background/Custom::Helpers/custom_class_method",
						timestamp: 1651700387308,
						traceId: "40c7dedd273ee4a475756393a996a03b",
						"transaction.name": null,
						transactionId: "ab968a3e203d2451",
					},
					{
						"code.lineno": "11",
						"code.namespace": "Custom::Helpers",
						"code.function": "custom_class_method",
						name: "OtherTransaction/Background/Custom::Helpers/custom_class_method",
						timestamp: 1651699137312,
						traceId: "ffe331a263b4cc7dd7080ed9f2f5faba",
						"transaction.name": null,
						transactionId: "a0627ed02eb626c0",
					},
				],
				"Custom/CLMtesting/InstanceMethod": [
					{
						"code.lineno": 33,
						"code.namespace": "Custom::Helpers",
						"code.function": "custom_instance_method_too",
						name: "Custom/CLMtesting/InstanceMethod",
						timestamp: 1651700387308,
						traceId: "40c7dedd273ee4a475756393a996a03b",
						"transaction.name": null,
						transactionId: "ab968a3e203d2451",
					},
					{
						"code.lineno": 33,
						"code.namespace": "Custom::Helpers",
						"code.function": "custom_instance_method_too",
						name: "Custom/CLMtesting/InstanceMethod",
						timestamp: 1651700356133,
						traceId: "26d3724a5635120ede570b383ddf5790",
						"transaction.name": null,
						transactionId: "2e1a7d60f6a4400d",
					},
				],
				"Nested/OtherTransaction/Background/Custom::Helpers/custom_instance_method": [
					{
						"code.lineno": "27",
						"code.namespace": "Custom::Helpers",
						"code.function": "custom_instance_method",
						name: "OtherTransaction/Background/Custom::Helpers/custom_instance_method",
						timestamp: 1651700387308,
						traceId: "40c7dedd273ee4a475756393a996a03b",
						"transaction.name": null,
						transactionId: "ab968a3e203d2451",
					},
					{
						"code.lineno": "27",
						"code.namespace": "Custom::Helpers",
						"code.function": "custom_instance_method",
						name: "OtherTransaction/Background/Custom::Helpers/custom_instance_method",
						timestamp: 1651700356133,
						traceId: "26d3724a5635120ede570b383ddf5790",
						"transaction.name": null,
						transactionId: "2e1a7d60f6a4400d",
					},
				],
				"Custom/CLMtesting/ClassMethod": [
					{
						"code.lineno": 16,
						"code.namespace": "Custom::Helpers",
						"code.function": "self.custom_class_method_too",
						name: "Custom/CLMtesting/ClassMethod",
						timestamp: 1651700387308,
						traceId: "40c7dedd273ee4a475756393a996a03b",
						"transaction.name": null,
						transactionId: "ab968a3e203d2451",
					},
					{
						"code.lineno": 16,
						"code.namespace": "Custom::Helpers",
						"code.function": "self.custom_class_method_too",
						name: "Custom/CLMtesting/ClassMethod",
						timestamp: 1651700356133,
						traceId: "26d3724a5635120ede570b383ddf5790",
						"transaction.name": null,
						transactionId: "2e1a7d60f6a4400d",
					},
				],
			};

			const metricTimesliceNames: MetricTimeslice[] = [
				{
					facet: "Nested/OtherTransaction/Background/Custom::Helpers/custom_class_method",
					averageDuration: 1.1,
					metricTimesliceName:
						"Nested/OtherTransaction/Background/Custom::Helpers/custom_class_method",
				},
				{
					facet: "Nested/OtherTransaction/Background/Custom::Helpers/custom_instance_method",
					averageDuration: 1.2,
					metricTimesliceName:
						"Nested/OtherTransaction/Background/Custom::Helpers/custom_instance_method",
				},
				{
					facet: "Custom/CLMtesting/ClassMethod",
					averageDuration: 1.3,
					metricTimesliceName: "Custom/CLMtesting/ClassMethod",
				},
				{
					facet: "Custom/CLMtesting/InstanceMethod",
					averageDuration: 1.4,
					metricTimesliceName: "Custom/CLMtesting/InstanceMethod",
				},
			];

			const results = strategy.addMethodName(groupedByTransactionName, metricTimesliceNames);
			// console.info("result", JSON.stringify(results, null, 2));
			expect(results).toEqual([
				{
					className: "Helpers",
					facet: "Nested/OtherTransaction/Background/Custom::Helpers/custom_class_method",
					metricTimesliceName:
						"Nested/OtherTransaction/Background/Custom::Helpers/custom_class_method",
					averageDuration: 1.1,
					namespace: "Custom",
					metadata: {
						"code.lineno": "11",
						traceId: "40c7dedd273ee4a475756393a996a03b",
						transactionId: "ab968a3e203d2451",
						"code.namespace": "Custom",
						"code.function": "custom_class_method",
					},
					functionName: "custom_class_method",
				},
				{
					className: "Helpers",
					facet: "Nested/OtherTransaction/Background/Custom::Helpers/custom_instance_method",
					metricTimesliceName:
						"Nested/OtherTransaction/Background/Custom::Helpers/custom_instance_method",
					averageDuration: 1.2,
					namespace: "Custom",
					metadata: {
						"code.lineno": "27",
						traceId: "40c7dedd273ee4a475756393a996a03b",
						transactionId: "ab968a3e203d2451",
						"code.namespace": "Custom",
						"code.function": "custom_instance_method",
					},
					functionName: "custom_instance_method",
				},
				{
					facet: "Custom/CLMtesting/ClassMethod",
					averageDuration: 1.3,
					className: "Helpers",
					functionName: "self.custom_class_method_too",
					metricTimesliceName: "Custom/CLMtesting/ClassMethod",
					namespace: "Custom",
					metadata: {
						"code.lineno": 16,
						traceId: "40c7dedd273ee4a475756393a996a03b",
						transactionId: "ab968a3e203d2451",
						"code.namespace": "Custom",
						"code.function": "self.custom_class_method_too",
					},
				},
				{
					facet: "Custom/CLMtesting/InstanceMethod",
					averageDuration: 1.4,
					className: "Helpers",
					functionName: "custom_instance_method_too",
					metricTimesliceName: "Custom/CLMtesting/InstanceMethod",
					namespace: "Custom",
					metadata: {
						"code.lineno": 33,
						traceId: "40c7dedd273ee4a475756393a996a03b",
						transactionId: "ab968a3e203d2451",
						"code.namespace": "Custom",
						"code.function": "custom_instance_method_too",
					},
				},
			]);
		});

		it("parses ruby class/function syntax", () => {
			const provider = new NewRelicProviderStub({} as any, {} as any);
			const strategy = new FLTCodeAttributeStrategy(
				"entityGuid",
				1,
				"ruby",
				"/foo/bar.rb",
				{
					fileUri: "/foo/bar.rb",
					languageId: "ruby",
				},
				"locator",
				provider
			);
			const groupedByTransactionName: Dictionary<Span[]> = {
				"Nested/OtherTransaction/Background/WhichIsWhich/samename": [
					{
						"code.filepath": "/usr/src/app/lib/which_is_which.rb",
						"code.function": "samename",
						"code.lineno": "20",
						"code.namespace": "WhichIsWhich",
						name: "Nested/OtherTransaction/Background/WhichIsWhich/samename",
						timestamp: 1651855258268,
						traceId: "8c39f01c9e867d5d7179a6a5152a8f8e",
						"transaction.name": null,
						transactionId: "90b4cb9daa96f88b",
					},
					{
						"code.filepath": "/usr/src/app/lib/which_is_which.rb",
						"code.function": "self.samename",
						"code.lineno": "9",
						"code.namespace": "WhichIsWhich",
						name: "Nested/OtherTransaction/Background/WhichIsWhich/samename",
						timestamp: 1651855257962,
						traceId: "8c39f01c9e867d5d7179a6a5152a8f8e",
						"transaction.name": null,
						transactionId: "90b4cb9daa96f88b",
					},
				],
			};

			const metricTimesliceNames: MetricTimeslice[] = [
				{
					facet: "Nested/OtherTransaction/Background/WhichIsWhich/samename",
					averageDuration: 1.1,
					metricTimesliceName: "Nested/OtherTransaction/Background/WhichIsWhich/samename",
				},
				{
					facet: "Nested/OtherTransaction/Background/WhichIsWhich/samename",
					averageDuration: 1.2,
					metricTimesliceName: "Nested/OtherTransaction/Background/WhichIsWhich/samename",
				},
			];

			const results = strategy.addMethodName(groupedByTransactionName, metricTimesliceNames);
			// console.info("result", JSON.stringify(results, null, 2));
			expect(results).toEqual([
				{
					className: "WhichIsWhich",
					facet: "Nested/OtherTransaction/Background/WhichIsWhich/samename",
					metricTimesliceName: "Nested/OtherTransaction/Background/WhichIsWhich/samename",
					averageDuration: 1.1,
					namespace: "WhichIsWhich",
					metadata: {
						"code.function": "samename",
						"code.lineno": "20",
						traceId: "8c39f01c9e867d5d7179a6a5152a8f8e",
						transactionId: "90b4cb9daa96f88b",
						"code.namespace": "WhichIsWhich",
					},
					functionName: "samename",
				},
				{
					className: "WhichIsWhich",
					facet: "Nested/OtherTransaction/Background/WhichIsWhich/samename",
					metricTimesliceName: "Nested/OtherTransaction/Background/WhichIsWhich/samename",
					averageDuration: 1.2,
					namespace: "WhichIsWhich",
					metadata: {
						"code.function": "samename",
						"code.lineno": "20",
						traceId: "8c39f01c9e867d5d7179a6a5152a8f8e",
						transactionId: "90b4cb9daa96f88b",
						"code.namespace": "WhichIsWhich",
					},
					functionName: "samename",
				},
			]);
		});

		it("getsSpansForFlask", async () => {
			const provider = new NewRelicProviderStub2({} as any, {} as any);
			const strategy = new FLTCodeAttributeStrategy(
				"entityGuid",
				1,
				"python",
				"/foo/bar.py",
				{
					fileUri: "/foo/bar.py",
					languageId: "python",
				},
				"locator",
				provider
			);

			const results = await strategy.addMethodName(
				{
					"Function/apis.v2.superheros:superheros_superhero_by_slug": [
						{
							"code.filepath": "/superheros/apis/v2/superheroes.py",
							"code.function": "SuperheroBySlug",
							name: "Function/apis.v2.superheros:superheros_superhero_by_slug",
							timestamp: 1647612515523,
							"transaction.name": null,
						},
					],
				},
				[
					{
						facet: "Function/apis.v2.superheros:superheros_superhero_by_slug",
						averageDuration: 0.0025880090121565193,
						metricTimesliceName: "Function/apis.v2.superheros:superheros_superhero_by_slug",
					},
				]
			);

			// console.log(JSON.stringify(results, null, 4));
			// NOTE: this data is not quite correct, but we're testing to assert that we will use whatever is in `code.function`
			expect(results[0].functionName).toEqual("SuperheroBySlug");
		});
	});
});

class NewRelicProviderStubBase extends NewRelicProvider {
	isConnected(user: CSMe): boolean {
		return true;
	}

	public async getEntityCount(): Promise<GetEntityCountResponse> {
		return { entityCount: 1 };
	}

	async getObservabilityEntityRepos(repoId: string): Promise<ObservabilityRepo | undefined> {
		return {
			repoId: "123",
			hasRepoAssociation: true,
			hasCodeLevelMetricSpanData: true,
			repoName: "foo",
			repoRemote: "https://example.com",
			entityAccounts: [
				{
					accountId: 123,
					accountName: "name",
					entityGuid: "123",
					entityName: "entity",
					tags: [
						{
							key: "url",
							values: ["cheese"],
						},
					],
				},
			],
		};
	}

	async getMethodAverageDuration(request: MetricQueryRequest): Promise<any> {
		return {
			actor: {
				account: {
					metrics: {
						results: [],
					},
					extrapolations: {
						results: [],
					},
				},
			},
		};
	}

	async getMethodErrorCount(request: MetricQueryRequest): Promise<any> {
		return {
			actor: {
				account: {
					metrics: {
						results: [],
					},
					extrapolations: {
						results: [],
					},
				},
			},
		};
	}

	protected async findRepositoryEntitiesByRepoRemotes(remotes: string[]): Promise<any> {
		return {
			entities: [
				{
					guid: "123456",
					name: "my-entity",
					account: {
						id: 1,
						name: "name",
					},
					tags: [
						{
							key: "accountId",
							values: ["1"],
						},
						{
							key: "url",
							values: ["git@yoursourcecode.net:biz-enablement/foo-account-persister.git"],
						},
					],
				},
			] as Entity[],
			remotes: await this.buildRepoRemoteVariants(remotes),
		};
	}

	protected async findRelatedEntityByRepositoryGuids(
		repositoryGuids: string[]
	): Promise<RelatedEntityByRepositoryGuidsResult> {
		return {
			actor: {
				entities: [
					{
						relatedEntities: {
							results: [
								{
									source: {
										entity: {
											account: {
												id: 1,
												name: "name",
											},
											name: "src-entity",
											type: "APPLICATION",
											tags: [
												{
													key: "accountId",
													values: ["1"],
												},
											],
										},
									},
									target: {
										entity: {
											account: {
												id: 1,
												name: "name",
											},
											name: "target-entity",
											type: "REPOSITORY",
											tags: [
												{
													key: "accountId",
													values: ["1"],
												},
											],
										},
									},
								},
							] as RelatedEntity[],
						},
					},
				],
			},
		};
	}
}

class NewRelicProviderStub extends NewRelicProviderStubBase {
	async getSpans(request: MetricQueryRequest): Promise<Span[] | undefined> {
		return [
			{
				"code.lineno": 1892,
				"code.namespace": "flask.app.Flask",
				name: "Function/flask.app:Flask.do_teardown_request",
				timestamp: 1647612755718,
				traceId: "eeaea27222ebc8bd9620532a39eba2ee",
				"transaction.name": null,
				transactionId: "eeaea27222ebc8bd",
			},
			{
				"code.lineno": 1925,
				"code.namespace": "flask.app.Flask",
				name: "Function/flask.app:Flask.do_teardown_appcontext",
				timestamp: 1647612755718,
				traceId: "eeaea27222ebc8bd9620532a39eba2ee",
				"transaction.name": null,
				transactionId: "eeaea27222ebc8bd",
			},
			{
				"code.lineno": null,
				"code.namespace": null,
				name: "Python/WSGI/Response",
				timestamp: 1647612755718,
				traceId: "eeaea27222ebc8bd9620532a39eba2ee",
				"transaction.name": null,
				transactionId: "eeaea27222ebc8bd",
			},
			{
				"code.lineno": null,
				"code.namespace": null,
				name: "Python/WSGI/Finalize",
				timestamp: 1647612755718,
				traceId: "eeaea27222ebc8bd9620532a39eba2ee",
				"transaction.name": null,
				transactionId: "eeaea27222ebc8bd",
			},
			{
				"code.lineno": 464,
				"code.namespace": "werkzeug.wsgi.ClosingIterator",
				name: "Function/werkzeug.wsgi:ClosingIterator.close",
				timestamp: 1647612755718,
				traceId: "eeaea27222ebc8bd9620532a39eba2ee",
				"transaction.name": null,
				transactionId: "eeaea27222ebc8bd",
			},
			{
				"code.lineno": 1363,
				"code.namespace": "flask.app.Flask",
				name: "Function/flask.app:Flask.handle_user_exception",
				timestamp: 1647612755717,
				traceId: "eeaea27222ebc8bd9620532a39eba2ee",
				"transaction.name": null,
				transactionId: "eeaea27222ebc8bd",
			},
			{
				"code.lineno": 1395,
				"code.namespace": "flask.app.Flask",
				name: "Function/flask.app:Flask.handle_exception",
				timestamp: 1647612755717,
				traceId: "eeaea27222ebc8bd9620532a39eba2ee",
				"transaction.name": null,
				transactionId: "eeaea27222ebc8bd",
			},
			{
				"code.lineno": 1864,
				"code.namespace": "flask.app.Flask",
				name: "Function/flask.app:Flask.process_response",
				timestamp: 1647612755717,
				traceId: "eeaea27222ebc8bd9620532a39eba2ee",
				"transaction.name": null,
				transactionId: "eeaea27222ebc8bd",
			},
			{
				"code.lineno": 27,
				"code.namespace": "routes.app",
				name: "Function/routes.app:error",
				timestamp: 1647612755717,
				traceId: "eeaea27222ebc8bd9620532a39eba2ee",
				"transaction.name": null,
				transactionId: "eeaea27222ebc8bd",
			},
			{
				"code.lineno": null,
				"code.namespace": null,
				name: "Python/WSGI/Application",
				timestamp: 1647612755716,
				traceId: "eeaea27222ebc8bd9620532a39eba2ee",
				"transaction.name": null,
				transactionId: "eeaea27222ebc8bd",
			},
			{
				"code.lineno": 2086,
				"code.namespace": "flask.app.Flask",
				name: "Function/flask.app:Flask",
				timestamp: 1647612755716,
				traceId: "eeaea27222ebc8bd9620532a39eba2ee",
				"transaction.name": null,
				transactionId: "eeaea27222ebc8bd",
			},
			{
				"code.lineno": 1837,
				"code.namespace": "flask.app.Flask",
				name: "Function/flask.app:Flask.preprocess_request",
				timestamp: 1647612755716,
				traceId: "eeaea27222ebc8bd9620532a39eba2ee",
				"transaction.name": null,
				transactionId: "eeaea27222ebc8bd",
			},
			{
				"code.lineno": 2086,
				"code.namespace": "flask.app.Flask",
				name: "Function/routes.app:error",
				timestamp: 1647612755716,
				traceId: "eeaea27222ebc8bd9620532a39eba2ee",
				"transaction.name": "WebTransaction/Function/routes.app:error",
				transactionId: "eeaea27222ebc8bd",
			},
			{
				"code.lineno": null,
				"code.namespace": null,
				name: "Python/WSGI/Response",
				timestamp: 1647612669352,
				traceId: "f6162d7b5374c64014c41ab0629add6c",
				"transaction.name": null,
				transactionId: "f6162d7b5374c640",
			},
			{
				"code.lineno": null,
				"code.namespace": null,
				name: "Python/WSGI/Finalize",
				timestamp: 1647612669352,
				traceId: "f6162d7b5374c64014c41ab0629add6c",
				"transaction.name": null,
				transactionId: "f6162d7b5374c640",
			},
			{
				"code.lineno": 464,
				"code.namespace": "werkzeug.wsgi.ClosingIterator",
				name: "Function/werkzeug.wsgi:ClosingIterator.close",
				timestamp: 1647612669352,
				traceId: "f6162d7b5374c64014c41ab0629add6c",
				"transaction.name": null,
				transactionId: "f6162d7b5374c640",
			},
			{
				"code.lineno": 1925,
				"code.namespace": "flask.app.Flask",
				name: "Function/flask.app:Flask.do_teardown_appcontext",
				timestamp: 1647612669352,
				traceId: "f6162d7b5374c64014c41ab0629add6c",
				"transaction.name": null,
				transactionId: "f6162d7b5374c640",
			},
			{
				"code.lineno": 1892,
				"code.namespace": "flask.app.Flask",
				name: "Function/flask.app:Flask.do_teardown_request",
				timestamp: 1647612669351,
				traceId: "f6162d7b5374c64014c41ab0629add6c",
				"transaction.name": null,
				transactionId: "f6162d7b5374c640",
			},
			{
				"code.lineno": 1395,
				"code.namespace": "flask.app.Flask",
				name: "Function/flask.app:Flask.handle_exception",
				timestamp: 1647612669351,
				traceId: "f6162d7b5374c64014c41ab0629add6c",
				"transaction.name": null,
				transactionId: "f6162d7b5374c640",
			},
			{
				"code.lineno": 1864,
				"code.namespace": "flask.app.Flask",
				name: "Function/flask.app:Flask.process_response",
				timestamp: 1647612669351,
				traceId: "f6162d7b5374c64014c41ab0629add6c",
				"transaction.name": null,
				transactionId: "f6162d7b5374c640",
			},
			{
				"code.lineno": 1363,
				"code.namespace": "flask.app.Flask",
				name: "Function/flask.app:Flask.handle_user_exception",
				timestamp: 1647612669350,
				traceId: "f6162d7b5374c64014c41ab0629add6c",
				"transaction.name": null,
				transactionId: "f6162d7b5374c640",
			},
			{
				"code.lineno": 2086,
				"code.namespace": "flask.app.Flask",
				name: "Function/routes.app:error",
				timestamp: 1647612669350,
				traceId: "f6162d7b5374c64014c41ab0629add6c",
				"transaction.name": "WebTransaction/Function/routes.app:error",
				transactionId: "f6162d7b5374c640",
			},
			{
				"code.lineno": null,
				"code.namespace": null,
				name: "Python/WSGI/Application",
				timestamp: 1647612669350,
				traceId: "f6162d7b5374c64014c41ab0629add6c",
				"transaction.name": null,
				transactionId: "f6162d7b5374c640",
			},
			{
				"code.lineno": 2086,
				"code.namespace": "flask.app.Flask",
				name: "Function/flask.app:Flask",
				timestamp: 1647612669350,
				traceId: "f6162d7b5374c64014c41ab0629add6c",
				"transaction.name": null,
				transactionId: "f6162d7b5374c640",
			},
			{
				"code.lineno": 1837,
				"code.namespace": "flask.app.Flask",
				name: "Function/flask.app:Flask.preprocess_request",
				timestamp: 1647612669350,
				traceId: "f6162d7b5374c64014c41ab0629add6c",
				"transaction.name": null,
				transactionId: "f6162d7b5374c640",
			},
			{
				"code.lineno": 27,
				"code.namespace": "routes.app",
				name: "Function/routes.app:error",
				timestamp: 1647612669350,
				traceId: "f6162d7b5374c64014c41ab0629add6c",
				"transaction.name": null,
				transactionId: "f6162d7b5374c640",
			},
			{
				"code.lineno": null,
				"code.namespace": null,
				name: "Python/WSGI/Response",
				timestamp: 1647612515523,
				traceId: "9ecccdf563986be9ae6c00b834b90a3e",
				"transaction.name": null,
				transactionId: "9ecccdf563986be9",
			},
			{
				"code.lineno": null,
				"code.namespace": null,
				name: "Python/WSGI/Finalize",
				timestamp: 1647612515523,
				traceId: "9ecccdf563986be9ae6c00b834b90a3e",
				"transaction.name": null,
				transactionId: "9ecccdf563986be9",
			},
			{
				"code.lineno": 464,
				"code.namespace": "werkzeug.wsgi.ClosingIterator",
				name: "Function/werkzeug.wsgi:ClosingIterator.close",
				timestamp: 1647612515523,
				traceId: "9ecccdf563986be9ae6c00b834b90a3e",
				"transaction.name": null,
				transactionId: "9ecccdf563986be9",
			},
			{
				"code.lineno": 1925,
				"code.namespace": "flask.app.Flask",
				name: "Function/flask.app:Flask.do_teardown_appcontext",
				timestamp: 1647612515523,
				traceId: "9ecccdf563986be9ae6c00b834b90a3e",
				"transaction.name": null,
				transactionId: "9ecccdf563986be9",
			},
			{
				"code.lineno": 1892,
				"code.namespace": "flask.app.Flask",
				name: "Function/flask.app:Flask.do_teardown_request",
				timestamp: 1647612515522,
				traceId: "9ecccdf563986be9ae6c00b834b90a3e",
				"transaction.name": null,
				transactionId: "9ecccdf563986be9",
			},
			{
				"code.lineno": 1864,
				"code.namespace": "flask.app.Flask",
				name: "Function/flask.app:Flask.process_response",
				timestamp: 1647612515522,
				traceId: "9ecccdf563986be9ae6c00b834b90a3e",
				"transaction.name": null,
				transactionId: "9ecccdf563986be9",
			},
			{
				"code.lineno": 464,
				"code.namespace": "werkzeug.wsgi.ClosingIterator",
				name: "Function/werkzeug.wsgi:ClosingIterator.close",
				timestamp: 1647612515521,
				traceId: "9ecccdf563986be9ae6c00b834b90a3e",
				"transaction.name": null,
				transactionId: "793a543ef938a9fb",
			},
			{
				"code.lineno": null,
				"code.namespace": null,
				name: "Python/WSGI/Finalize",
				timestamp: 1647612515521,
				traceId: "9ecccdf563986be9ae6c00b834b90a3e",
				"transaction.name": null,
				transactionId: "793a543ef938a9fb",
			},
			{
				"code.lineno": 40,
				"code.namespace": "routes.app",
				name: "Function/routes.app:external_source",
				timestamp: 1647612515520,
				traceId: "9ecccdf563986be9ae6c00b834b90a3e",
				"transaction.name": null,
				transactionId: "793a543ef938a9fb",
			},
			{
				"code.lineno": 1864,
				"code.namespace": "flask.app.Flask",
				name: "Function/flask.app:Flask.process_response",
				timestamp: 1647612515520,
				traceId: "9ecccdf563986be9ae6c00b834b90a3e",
				"transaction.name": null,
				transactionId: "793a543ef938a9fb",
			},
			{
				"code.lineno": 1892,
				"code.namespace": "flask.app.Flask",
				name: "Function/flask.app:Flask.do_teardown_request",
				timestamp: 1647612515520,
				traceId: "9ecccdf563986be9ae6c00b834b90a3e",
				"transaction.name": null,
				transactionId: "793a543ef938a9fb",
			},
			{
				"code.lineno": 1925,
				"code.namespace": "flask.app.Flask",
				name: "Function/flask.app:Flask.do_teardown_appcontext",
				timestamp: 1647612515520,
				traceId: "9ecccdf563986be9ae6c00b834b90a3e",
				"transaction.name": null,
				transactionId: "793a543ef938a9fb",
			},
			{
				"code.lineno": null,
				"code.namespace": null,
				name: "Python/WSGI/Response",
				timestamp: 1647612515520,
				traceId: "9ecccdf563986be9ae6c00b834b90a3e",
				"transaction.name": null,
				transactionId: "793a543ef938a9fb",
			},
			{
				"code.lineno": 1837,
				"code.namespace": "flask.app.Flask",
				name: "Function/flask.app:Flask.preprocess_request",
				timestamp: 1647612515519,
				traceId: "9ecccdf563986be9ae6c00b834b90a3e",
				"transaction.name": null,
				transactionId: "793a543ef938a9fb",
			},
			{
				"code.lineno": null,
				"code.namespace": null,
				name: "Python/WSGI/Application",
				timestamp: 1647612515519,
				traceId: "9ecccdf563986be9ae6c00b834b90a3e",
				"transaction.name": null,
				transactionId: "793a543ef938a9fb",
			},
			{
				"code.lineno": 2086,
				"code.namespace": "flask.app.Flask",
				name: "Function/flask.app:Flask",
				timestamp: 1647612515519,
				traceId: "9ecccdf563986be9ae6c00b834b90a3e",
				"transaction.name": null,
				transactionId: "793a543ef938a9fb",
			},
			{
				"code.lineno": 2086,
				"code.namespace": "flask.app.Flask",
				name: "Function/routes.app:external_source",
				timestamp: 1647612515518,
				traceId: "9ecccdf563986be9ae6c00b834b90a3e",
				"transaction.name": "WebTransaction/Function/routes.app:external_source",
				transactionId: "793a543ef938a9fb",
			},
			{
				"code.lineno": null,
				"code.namespace": null,
				name: "External/localhost:8000/requests/",
				timestamp: 1647612515514,
				traceId: "9ecccdf563986be9ae6c00b834b90a3e",
				"transaction.name": null,
				transactionId: "9ecccdf563986be9",
			},
			{
				"code.lineno": 2086,
				"code.namespace": "flask.app.Flask",
				name: "Function/routes.app:external_call",
				timestamp: 1647612515514,
				traceId: "9ecccdf563986be9ae6c00b834b90a3e",
				"transaction.name": "WebTransaction/Function/routes.app:external_call",
				transactionId: "9ecccdf563986be9",
			},
			{
				"code.lineno": null,
				"code.namespace": null,
				name: "Python/WSGI/Application",
				timestamp: 1647612515514,
				traceId: "9ecccdf563986be9ae6c00b834b90a3e",
				"transaction.name": null,
				transactionId: "9ecccdf563986be9",
			},
			{
				"code.lineno": 2086,
				"code.namespace": "flask.app.Flask",
				name: "Function/flask.app:Flask",
				timestamp: 1647612515514,
				traceId: "9ecccdf563986be9ae6c00b834b90a3e",
				"transaction.name": null,
				transactionId: "9ecccdf563986be9",
			},
			{
				"code.lineno": 1837,
				"code.namespace": "flask.app.Flask",
				name: "Function/flask.app:Flask.preprocess_request",
				timestamp: 1647612515514,
				traceId: "9ecccdf563986be9ae6c00b834b90a3e",
				"transaction.name": null,
				transactionId: "9ecccdf563986be9",
			},
			{
				"code.lineno": 32,
				"code.namespace": "routes.app",
				name: "Function/routes.app:external_call",
				timestamp: 1647612515514,
				traceId: "9ecccdf563986be9ae6c00b834b90a3e",
				"transaction.name": null,
				transactionId: "9ecccdf563986be9",
			},
		];
	}

	isConnected(user: CSMe): boolean {
		return true;
	}

	public async getEntityCount(): Promise<GetEntityCountResponse> {
		return { entityCount: 1 };
	}

	async getObservabilityEntityRepos(repoId: string): Promise<ObservabilityRepo | undefined> {
		return {
			repoId: "123",
			hasRepoAssociation: true,
			hasCodeLevelMetricSpanData: true,
			repoName: "foo",
			repoRemote: "https://example.com",
			entityAccounts: [
				{
					accountId: 123,
					accountName: "name",
					entityGuid: "123",
					entityName: "entity",
					tags: [
						{
							key: "url",
							values: ["cheese"],
						},
					],
				},
			],
		};
	}

	async getMethodSampleSize(request: MetricQueryRequest) {
		return {
			actor: {
				account: {
					metrics: {
						results: [
							{
								facet: "Function/routes.app:error",
								metricTimesliceName: "Function/routes.app:error",
								requestsPerMinute: 0.2,
							},
							{
								facet: "Function/routes.app:hello_world",
								metricTimesliceName: "Function/routes.app:hello_world",
								requestsPerMinute: 0.06666666666666667,
							},
						],
					},
					spans: {
						results: [
							{
								facet: "Function/routes.app:error",
								metricTimesliceName: "Function/routes.app:error",
								requestsPerMinute: 0.2,
							},
							{
								facet: "Function/routes.app:hello_world",
								metricTimesliceName: "Function/routes.app:hello_world",
								requestsPerMinute: 0.06666666666666667,
							},
						],
					},
				},
			},
		};
	}

	async getMethodAverageDuration(request: MetricQueryRequest) {
		return {
			actor: {
				account: {
					metrics: {
						results: [
							{
								facet: "WebTransaction/Function/routes.app:error",
								averageDuration: 0.0025880090121565193,
								metricTimesliceName: "WebTransaction/Function/routes.app:error",
							},
							{
								facet: "WebTransaction/Function/routes.app:hello_world",
								averageDuration: 0.0015958845615386963,
								metricTimesliceName: "WebTransaction/Function/routes.app:hello_world",
							},
						],
					},
					spans: {
						results: [
							{
								facet: "WebTransaction/Function/routes.app:error",
								averageDuration: 0.0025880090121565193,
								metricTimesliceName: "WebTransaction/Function/routes.app:error",
							},
							{
								facet: "WebTransaction/Function/routes.app:hello_world",
								averageDuration: 0.0015958845615386963,
								metricTimesliceName: "WebTransaction/Function/routes.app:hello_world",
							},
						],
					},
				},
			},
		};
	}

	async getMethodErrorCount(request: MetricQueryRequest) {
		return {
			actor: {
				account: {
					metrics: {
						results: [
							{
								facet: "Errors/WebTransaction/Function/routes.app:error",
								errorsPerMinute: 0.48333333333333334,
								metricTimesliceName: "Errors/WebTransaction/Function/routes.app:error",
							},
						],
					},
					spans: {
						results: [
							{
								facet: "Errors/WebTransaction/Function/routes.app:error",
								errorsPerMinute: 0.48333333333333334,
								metricTimesliceName: "Errors/WebTransaction/Function/routes.app:error",
							},
						],
					},
				},
			},
		};
	}
}

class NewRelicProviderStub2 extends NewRelicProviderStubBase {
	async getSpans(request: MetricQueryRequest): Promise<Span[] | undefined> {
		return [
			{
				"code.function": "create_bill_credit_payment_thing",
				name: "Carrot/foo_bar.bills.tasks.create_bill_credit_payment_thing",
				timestamp: 1647631200451,
				"transaction.name":
					"OtherTransaction/Carrot/foo_bar.bills.tasks.create_bill_credit_payment_thing",
			},
		];
	}

	async getMethodSampleSize(request: MetricQueryRequest) {
		return {
			actor: {
				account: {
					metrics: {
						results: [
							{
								facet:
									"OtherTransaction/Carrot/foo_bar.bills.tasks.create_bill_credit_payment_thing",
								metricTimesliceName:
									"OtherTransaction/Carrot/foo_bar.bills.tasks.create_bill_credit_payment_thing",
								requestsPerMinute: 0.35,
							},
						],
					},
					spans: {
						results: [
							{
								facet:
									"OtherTransaction/Carrot/foo_bar.bills.tasks.create_bill_credit_payment_thing",
								metricTimesliceName:
									"OtherTransaction/Carrot/foo_bar.bills.tasks.create_bill_credit_payment_thing",
								requestsPerMinute: 0.35,
							},
						],
					},
				},
			},
		};
	}
}