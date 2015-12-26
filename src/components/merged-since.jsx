import React from 'react';
import _ from 'underscore';
import Client from '../github-client';
import {fetchAll, FETCHALL_MAX} from '../helpers';
import Loadable from './loadable';
import Time from './time';
import {getRelatedIssues} from '../gfm-dom';
import IssueStore from '../issue-store';
import IssueList from './issue-list';
import Issue from './issue';

const MERGE_PULL_REQUEST_MESSAGE_REGEXP = /^Merge\ pull\ request #(\d+)/;

const MergedSince = React.createClass({
  renderCard(repoOwner, repoName, issue) {
    const card = IssueStore.issueToCard(repoOwner, repoName, issue);
    return (
      <Issue card={card}/>
    );
  },
  renderPullRequest(pr) {
    const {comparison, repoOwner, repoName} = this.props;
    const relatedIssues = getRelatedIssues(pr.body, repoOwner, repoName);
    if (relatedIssues.length) {
      const relatedIssuesHtml = relatedIssues.map((related) => {
        const {repoOwner, repoName, number} = related;
        return (
          <Loadable
            key={repoOwner + repoName + number}
            promise={Client.getOcto().repos(repoOwner, repoName).issues(number).fetch()}
            renderLoaded={(issue) => this.renderCard(repoOwner, repoName, issue)}
          />
        );
      });
      return (
        <div className='-issues-related-to-the-pull-request'>
          {relatedIssuesHtml}
        </div>
      );
    } else {
      const card = IssueStore.issueToCard(repoOwner, repoName, pr);
      return (
        <Issue card={card}/>
      );
    }
  },
  render() {
    const {comparison, repoOwner, repoName, shaStart, shaEnd} = this.props;

    const prCommits = [];
    _.each(comparison[0].commits, (commit) => {
      const msg = commit.commit.message;
      const match = msg.match(MERGE_PULL_REQUEST_MESSAGE_REGEXP);
      if (match) {
        const title = msg.split('\n')[2];
        const at = new Date(commit.commit.author.date);
        prCommits.push({number: match[1], title, at});
      }
    });

    const children = _.map(prCommits, ({number, title, at}) => {
      if (number) {
        // Try and fetch the issue the PR fixed
        return (
          <Loadable
            key={number}
            promise={Client.getOcto().repos(repoOwner, repoName).issues(number).fetch()}
            renderLoaded={this.renderPullRequest}
          />
        );
      } else {
        console.error('Bug! someone created a commit titled "Merge pull request" without a number');
      }
    });

    return (
      <IssueList title={`Issues related to the Changes between ${shaStart} and ${shaEnd}`}>
        {children}
      </IssueList>
    );
  }
});

const MergedSinceShell = React.createClass({
  render() {
    let {repoOwner, repoNames, shaStart, shaEnd} = this.props.params;
    if (!shaEnd) {
      shaEnd = 'master';
    }

    return (
      <Loadable
        promise={fetchAll(FETCHALL_MAX, Client.getOcto().repos(repoOwner, repoNames).compare(shaStart, shaEnd).fetch)}
        renderLoaded={(comparison) => <MergedSince repoOwner={repoOwner} repoName={repoNames} comparison={comparison} shaStart={shaStart} shaEnd={shaEnd}/>}
      />
    );
  }
});

export default MergedSinceShell;
