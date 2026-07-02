import {ResultCard, type ResultCardProps} from "@knaw-huc/panoptes-react";

export interface SportSearchResultItem {
    id: string;
    title: string;
    description?: string;
    tags?: string[];
    sport: string;
    place: string;
    province: string;
    philosophy: string;
    startDateYear: string;
}

export interface SportResultCardProps extends SportSearchResultItem {
    link: string;
}

export default function SportResultCard(props: SportResultCardProps) {
    const description = [props.place, props.province, props.sport, props.startDateYear, props.philosophy]
                                .filter((v) => v !== null && v !== '').join(' - ');
    const resultCardProps: ResultCardProps = {
        title: props.title,
        link: props.link,
        description,
    };
    return (
        <ResultCard {...resultCardProps} />
    );
}