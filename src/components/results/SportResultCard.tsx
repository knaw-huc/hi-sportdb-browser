import {ResultCard, type ResultCardProps} from "@knaw-huc/panoptes-react";

export interface SportResultCardProps extends Partial<ResultCardProps> {
    id: string;
    title: string;
    link: string;
}

export default function SportResultCard(props: SportResultCardProps) {
    const { title , ...rest } = props as ResultCardProps;
    const resultCardProps: ResultCardProps = {
        ...rest,
        title,
    };

    return (
        <ResultCard {...resultCardProps} link={props.link} />
    );
}