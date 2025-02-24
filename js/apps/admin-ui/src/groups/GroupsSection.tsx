import type GroupRepresentation from "@keycloak/keycloak-admin-client/lib/defs/groupRepresentation";
import {
  Button,
  Drawer,
  DrawerContent,
  DrawerContentBody,
  DrawerHead,
  DrawerPanelContent,
  DropdownItem,
  PageSection,
  PageSectionVariants,
  Tab,
  TabTitleText,
  Tabs,
  Tooltip,
} from "@patternfly/react-core";
import { AngleLeftIcon, TreeIcon } from "@patternfly/react-icons";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";

import { GroupBreadCrumbs } from "../components/bread-crumb/GroupBreadCrumbs";
import { PermissionsTab } from "../components/permission-tab/PermissionTab";
import { ViewHeader } from "../components/view-header/ViewHeader";
import { useAccess } from "../context/access/Access";
import { fetchAdminUI } from "../context/auth/admin-ui-endpoint";
import { useRealm } from "../context/realm-context/RealmContext";
import helpUrls from "../help-urls";
import { useFetch } from "../utils/useFetch";
import useIsFeatureEnabled, { Feature } from "../utils/useIsFeatureEnabled";
import useToggle from "../utils/useToggle";
import { GroupAttributes } from "./GroupAttributes";
import { GroupRoleMapping } from "./GroupRoleMapping";
import { GroupTable } from "./GroupTable";
import { GroupsModal } from "./GroupsModal";
import { Members } from "./Members";
import { useSubGroups } from "./SubGroupsContext";
import { DeleteGroup } from "./components/DeleteGroup";
import { GroupTree } from "./components/GroupTree";
import { getId, getLastId } from "./groupIdUtils";
import { toGroups } from "./routes/Groups";

import "./GroupsSection.css";

export default function GroupsSection() {
  const { t } = useTranslation("groups");
  const [activeTab, setActiveTab] = useState(0);

  const { subGroups, setSubGroups, currentGroup } = useSubGroups();
  const { realm } = useRealm();

  const [rename, setRename] = useState<GroupRepresentation>();
  const [deleteOpen, toggleDeleteOpen] = useToggle();

  const navigate = useNavigate();
  const location = useLocation();
  const id = getLastId(location.pathname);

  const [open, toggle] = useToggle(true);
  const [key, setKey] = useState(0);
  const refresh = () => setKey(key + 1);

  const { hasAccess } = useAccess();
  const isFeatureEnabled = useIsFeatureEnabled();
  const canViewPermissions =
    isFeatureEnabled(Feature.AdminFineGrainedAuthz) &&
    hasAccess("manage-authorization", "manage-users", "manage-clients");
  const canManageGroup =
    hasAccess("manage-users") || currentGroup()?.access?.manage;
  const canManageRoles =
    hasAccess("manage-users") || currentGroup()?.access?.manage;
  const canViewDetails =
    hasAccess("query-groups", "view-users") ||
    hasAccess("manage-users", "query-groups");
  const canViewMembers =
    hasAccess("view-users") ||
    currentGroup()?.access?.viewMembers ||
    currentGroup()?.access?.manageMembers;

  useFetch(
    async () => {
      const ids = getId(location.pathname);
      const isNavigationStateInValid = ids && ids.length > subGroups.length;

      if (isNavigationStateInValid) {
        const groups: GroupRepresentation[] = [];
        for (const i of ids!) {
          const group =
            i !== "search"
              ? await fetchAdminUI<GroupRepresentation | undefined>(
                "ui-ext/groups/" + i,
              )
              : { name: t("searchGroups"), id: "search" };
          if (group) {
            groups.push(group);
          } else {
            throw new Error(t("common:notFound"));
          }
        }
        return groups;
      }
      return [];
    },
    (groups: GroupRepresentation[]) => {
      if (groups.length) setSubGroups(groups);
    },
    [id],
  );

  return (
    <>
      <DeleteGroup
        show={deleteOpen}
        toggleDialog={toggleDeleteOpen}
        selectedRows={[currentGroup()!]}
        refresh={() => {
          navigate(toGroups({ realm }));
          refresh();
        }}
      />
      {rename && (
        <GroupsModal
          id={id}
          rename={rename}
          refresh={(group) => {
            refresh();
            setSubGroups([...subGroups.slice(0, subGroups.length - 1), group!]);
          }}
          handleModalToggle={() => setRename(undefined)}
        />
      )}
      <PageSection variant={PageSectionVariants.light} className="pf-u-p-0">
        <Drawer isInline isExpanded={open} key={key} position="left">
          <DrawerContent
            panelContent={
              <DrawerPanelContent isResizable>
                <DrawerHead>
                  <GroupTree
                    refresh={refresh}
                    canViewDetails={canViewDetails}
                  />
                </DrawerHead>
              </DrawerPanelContent>
            }
          >
            <DrawerContentBody>
              <Tooltip content={open ? t("common:hide") : t("common:show")}>
                <Button
                  aria-label={open ? t("common:hide") : t("common:show")}
                  variant="plain"
                  icon={open ? <AngleLeftIcon /> : <TreeIcon />}
                  onClick={toggle}
                />
              </Tooltip>
              <GroupBreadCrumbs />
              <ViewHeader
                titleKey={!id ? "groups:groups" : currentGroup()?.name!}
                subKey={!id ? "groups:groupsDescription" : ""}
                helpUrl={!id ? helpUrls.groupsUrl : ""}
                divider={!id}
                dropdownItems={
                  id && canManageGroup
                    ? [
                      <DropdownItem
                        data-testid="renameGroupAction"
                        key="renameGroup"
                        onClick={() => setRename(currentGroup())}
                      >
                        {t("renameGroup")}
                      </DropdownItem>,
                      <DropdownItem
                        data-testid="deleteGroup"
                        key="deleteGroup"
                        onClick={toggleDeleteOpen}
                      >
                        {t("deleteGroup")}
                      </DropdownItem>,
                    ]
                    : undefined
                }
              />
              {subGroups.length > 0 && (
                <Tabs
                  inset={{
                    default: "insetNone",
                    md: "insetSm",
                    xl: "insetLg",
                    "2xl": "inset2xl",
                  }}
                  activeKey={activeTab}
                  onSelect={(_, key) => setActiveTab(key as number)}
                  isBox
                  mountOnEnter
                  unmountOnExit
                >
                  <Tab
                    data-testid="groups"
                    eventKey={0}
                    title={<TabTitleText>{t("childGroups")}</TabTitleText>}
                  >
                    <GroupTable
                      refresh={refresh}
                    />
                  </Tab>
                  {canViewMembers && (
                    <Tab
                      data-testid="members"
                      eventKey={1}
                      title={<TabTitleText>{t("members")}</TabTitleText>}
                    >
                      <Members />
                    </Tab>
                  )}
                  <Tab
                    data-testid="attributes"
                    eventKey={2}
                    title={
                      <TabTitleText>{t("common:attributes")}</TabTitleText>
                    }
                  >
                    <GroupAttributes />
                  </Tab>
                  {canManageRoles && (
                    <Tab
                      eventKey={3}
                      data-testid="role-mapping-tab"
                      title={<TabTitleText>{t("roleMapping")}</TabTitleText>}
                    >
                      <GroupRoleMapping id={id!} name={currentGroup()?.name!} />
                    </Tab>
                  )}
                  {canViewPermissions && (
                    <Tab
                      eventKey={4}
                      data-testid="permissionsTab"
                      title={
                        <TabTitleText>{t("common:permissions")}</TabTitleText>
                      }
                    >
                      <PermissionsTab id={id} type="groups" />
                    </Tab>
                  )}
                </Tabs>
              )}
              {subGroups.length === 0 && (
                <GroupTable
                  refresh={refresh}
                />
              )}
            </DrawerContentBody>
          </DrawerContent>
        </Drawer>
      </PageSection>
    </>
  );
}